angular.module('PerfApp', [])
.controller('MainCtrl', ['$http','$window', function($http,$window){
  const vm = this;
  vm.view = 'about';
  vm.loginForm = {};
  vm.pwd = { current: '', new: '', confirm: '' };
  vm.pwdError = null;
  vm.pwdMsg = null;
  vm.newEmp = {};
  vm.employees = [];
  vm.team = [];
  vm.availableMonths = [];
  vm.metricChart = null; // Chart.js instance holder
  vm.token = localStorage.getItem('token') || null;
  vm.role = localStorage.getItem('role') || null;

  vm.metricsList = [
  { key: 'quality_of_work', label: 'Quality of Work', score: null, comment: '' },
  { key: 'dependability', label: 'Dependability', score: null, comment: '' },
  { key: 'initiative', label: 'Initiative', score: null, comment: '' },
  { key: 'adaptability', label: 'Adaptability', score: null, comment: '' },
  { key: 'compliance', label: 'Compliance', score: null, comment: '' },
  { key: 'interpersonal', label: 'Interpersonal', score: null, comment: '' },
  { key: 'time_management', label: 'Time Management', score: null, comment: '' },
  { key: 'communication', label: 'Communication', score: null, comment: '' },
  { key: 'self_improvement', label: 'Self Improvement', score: null, comment: '' }
  ];

  // Weights for each metric (sum to 1.0)
  vm.metricWeights = {
    quality_of_work: 0.20,
    dependability: 0.10,
    initiative: 0.10,
    adaptability: 0.10,
    compliance: 0.10,
    interpersonal: 0.10,
    time_management: 0.10,
    communication: 0.10,
    self_improvement: 0.10
  };

  // Canonical order of metric keys
  vm.metricKeys = ['quality_of_work','dependability','initiative','adaptability','compliance','interpersonal','time_management','communication','self_improvement'];

vm.designations = [
  "Intern",
  "Assocciate Software Developer",
  "Software Developer",
  "Senior Software Developer",
  "Technical Lead",
  "Assocciate Development Manager",
  "Development Manager",
  "Senior Development Manager",
  "Assocciate Director",
  "Director",
  "Senior Director",
];
  vm.setAuth = function(token, role){
    vm.token = token; vm.role = role;
    localStorage.setItem('token', token); localStorage.setItem('role', role);
    $http.defaults.headers.common['Authorization'] = 'Bearer ' + token;
  };
  if(vm.token){
    $http.defaults.headers.common['Authorization'] = 'Bearer ' + vm.token;
  }

  vm.logout = function(){ localStorage.clear(); vm.token=null; vm.role=null; vm.view='about'; vm.employees=[]; vm.team=[]; };

  vm.resetPassword = function(){
    vm.pwdError = null; vm.pwdMsg = null;
    if (!vm.pwd.current || !vm.pwd.new || !vm.pwd.confirm) {
      vm.pwdError = 'Please fill out all fields.'; return;
    }
    if (vm.pwd.new !== vm.pwd.confirm) {
      vm.pwdError = 'New password and confirm password do not match.'; return;
    }
    if (vm.pwd.new.length < 6) {
      vm.pwdError = 'New password must be at least 6 characters.'; return;
    }
    $http.post('/api/auth/change_password', {
      current_password: vm.pwd.current,
      new_password: vm.pwd.new
    }).then(function(res){
      vm.pwdMsg = 'Password updated successfully.';
      // Close modal after a brief delay
      setTimeout(function(){
        try {
          var modalEl = document.getElementById('resetPwdModal');
          if (modalEl && window.bootstrap && window.bootstrap.Modal) {
            var instance = window.bootstrap.Modal.getInstance(modalEl) || new window.bootstrap.Modal(modalEl);
            instance.hide();
          }
        } catch (e) {}
        vm.pwd = { current: '', new: '', confirm: '' };
        vm.pwdError = null; vm.pwdMsg = null;
      }, 600);
    }, function(err){
      vm.pwdError = (err.data && (err.data.error || err.data.message)) || 'Failed to update password';
    });
  };

  vm.login = function(){
    vm.loginError = null;
    $http.post('/api/auth/login', vm.loginForm).then(function(res){
      vm.setAuth(res.data.token, res.data.role);
      vm.view = 'dashboard';
      vm.fetchDashboardSummary();
      vm.fetchEmployees();
      if(vm.role==='admin') vm.fetchTeam();
    }, function(err){ vm.loginError = err.data && err.data.error ? err.data.error : 'Login failed'; });
  };

  vm.fetchEmployees = function(){
    $http.get('/api/employees').then(function(res){
      vm.employees = res.data;
    });
  };

  vm.addEmployee = function() {
    $http.post('/api/employees', vm.newEmployee).then(function(res) {
      alert("Employee added successfully!");
      vm.newEmployee = {};  // reset form
      vm.fetchEmployees();  // reload employee list
    });
  };

  vm.viewEmployee = function(e, view='report'){ 
    vm.view=view; 
    vm.selectedEmp = e.id; 
    vm.selectedMonth = '';
    vm.loadAvailableMonths(e.id);
  };

  vm.addReview = function(e){ 
    vm.view='addreview'; 
    vm.selectedEmp = e.id;
  };

  vm.addAllMetrics = function(emp) {
  // Loop through all metrics and send scores + comments
  const payload = vm.metricsList.map(m => ({
    metric_key: m.key,
    score: m.score,
    comment: m.comment
  }));

  // Call backend API to save
  $http.post(`/api/employees/${emp}/metrics`, payload).then(
    function() {
      alert("Metrics saved successfully!");
    },
    function(err) {
      console.error("Error saving metrics", err);
    }
  );
};

  vm.loadMetrics = function(eid, month){
    const url = month ? (`/api/employees/${eid}/metrics?month=${encodeURIComponent(month)}`)
                      : (`/api/employees/${eid}/metrics`);
    $http.get(url).then(function(res){
      const data = res.data;
      const labels = [], scores = [];
      // compute average per metric key
      const grouped = {};
      data.forEach(d => {
        if(!grouped[d.metric_key]) grouped[d.metric_key]=[];
        grouped[d.metric_key].push(d.score);
      });
      vm.metricKeys.forEach(k => {
        labels.push(k);
        if(grouped[k]) scores.push(grouped[k].reduce((a,b)=>a+b,0)/grouped[k].length);
        else scores.push(0);
      });
      vm.chartData = {labels: labels, scores: scores};

      // Compute weighted final score: Σ (score × weight)
      let finalScore = 0;
      vm.metricKeys.forEach((k, idx) => {
        const w = vm.metricWeights[k] || 0;
        finalScore += (scores[idx] || 0) * w;
      });
      vm.finalScore = finalScore; // 0–4 scale
      setTimeout(()=>vm.renderChart(),50);
    });
  };

  vm.renderChart = function(){
    // Run this after data loads
    if (vm.chartData) {
      setTimeout(vm.initBarChart, 100);
    }
  };

  vm.initBarChart = function() {
  const canvas = document.getElementById('metricChart');
  if (!canvas) return;
  // Destroy existing chart instance if present to avoid canvas-in-use errors
  if (vm.metricChart && typeof vm.metricChart.destroy === 'function') {
    try { vm.metricChart.destroy(); } catch(e) {}
    vm.metricChart = null;
  }
  const ctx = canvas.getContext('2d');

  // Example: Compare metrics for one employee
  vm.metricChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: vm.chartData.labels,  // ["Quality", "Dependability", ...]
      datasets: [{
        label: 'Performance Scores',
        data: vm.chartData.scores,   // [85, 75, 90, ...]
        backgroundColor: [
          '#4e79a7','#f28e2b','#e15759','#76b7b2',
          '#59a14f','#edc949','#af7aa1','#ff9da7','#9c755f'
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Employee Performance by Metric'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 4,
          title: { display: true, text: 'Score (%)' }
        },
        x: {
          title: { display: true, text: 'Performance Metrics' }
        }
      }
    }
  });
};


  vm.fetchTeam = function(){
    $http.get('/api/team/aggregate').then(function(res){ vm.team = res.data; });
  };

  // Dashboard summary: current user + reportees
  vm.fetchDashboardSummary = function(){
    $http.get('/api/me/summary').then(function(res){
      vm.dashboard = res.data;
      if (vm.dashboard && vm.dashboard.employee && vm.dashboard.employee.id) {
        vm.loadAvailableMonths(vm.dashboard.employee.id);
      } else {
        vm.chartData = null;
        if (vm.metricChart && typeof vm.metricChart.destroy === 'function') {
          try { vm.metricChart.destroy(); } catch(e) {}
          vm.metricChart = null;
        }
      }
    });
  };

  // Load available months for the selected employee (distinct list from metrics)
  vm.loadAvailableMonths = function(eid){
    if(!eid) { vm.availableMonths = []; return; }
    $http.get(`/api/employees/${eid}/metrics`).then(function(res){
      const data = res.data || [];
      const months = Array.from(new Set(data.map(d => d.month).filter(Boolean)));
      // Sort ascending (assuming YYYY-MM or similar string)
      months.sort();
      vm.availableMonths = months;

      // Compute overall final rating across ALL months
      const groupedAll = {};
      data.forEach(d => {
        if(!groupedAll[d.metric_key]) groupedAll[d.metric_key] = [];
        groupedAll[d.metric_key].push(d.score);
      });
      const avgAll = vm.metricKeys.map(k => {
        const arr = groupedAll[k];
        return arr && arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length) : 0;
      });
      let overall = 0;
      vm.metricKeys.forEach((k, idx) => {
        const w = vm.metricWeights[k] || 0;
        overall += (avgAll[idx] || 0) * w;
      });
      vm.overallFinalScore = overall; // 0–4 scale

      if (months.length > 0) {
        vm.selectedMonth = months[0];
        vm.loadMetrics(eid, vm.selectedMonth);
      } else {
        vm.selectedMonth = '';
        vm.loadMetrics(eid);
      }
    });
  };

  // Generate dynamic avatar color based on name
  vm.getAvatarColor = function(name) {
    if (!name) return 1;
    // Simple hash function to generate consistent color index
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Return color index between 1-8
    return Math.abs(hash % 8) + 1;
  };

  // on load
  if(vm.token) { vm.fetchDashboardSummary(); vm.fetchEmployees(); }

}]);
