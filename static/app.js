angular.module('PerfApp', [])
.controller('MainCtrl', ['$http','$window', function($http,$window){
  const vm = this;
  vm.view = 'about';
  vm.loginForm = {};
  vm.newEmp = {};
  vm.employees = [];
  vm.team = [];
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

  vm.login = function(){
    vm.loginError = null;
    $http.post('/api/auth/login', vm.loginForm).then(function(res){
      vm.setAuth(res.data.token, res.data.role);
      vm.view = 'dashboard';
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

  vm.viewEmployee = function(e){ vm.view='dashboard'; vm.selectedEmp = e.id; vm.loadMetrics(e.id); };

  vm.addAllMetrics = function(emp) {
  // Loop through all metrics and send scores + comments
  const payload = vm.metricsList.map(m => ({
    metric_key: m.key,
    score: m.score,
    comment: m.comment
  }));

  // Call backend API to save
  $http.post(`/api/employees/${emp.id}/metrics`, payload).then(
    function() {
      alert("Metrics saved successfully!");
    },
    function(err) {
      console.error("Error saving metrics", err);
    }
  );
};

  vm.loadMetrics = function(eid){
    $http.get('/api/employees/'+eid+'/metrics').then(function(res){
      const data = res.data;
      const labels = [], scores = [];
      // compute average per metric key
      const grouped = {};
      data.forEach(d => {
        if(!grouped[d.metric_key]) grouped[d.metric_key]=[];
        grouped[d.metric_key].push(d.score);
      });
      const metricKeys = ['quality_of_work','dependability','initiative','adaptability','compliance','interpersonal','time_management','communication','self_improvement'];
      metricKeys.forEach(k => {
        labels.push(k);
        if(grouped[k]) scores.push(grouped[k].reduce((a,b)=>a+b,0)/grouped[k].length);
        else scores.push(0);
      });
      vm.chartData = {labels: labels, scores: scores};
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
  const ctx = document.getElementById('metricChart').getContext('2d');

  // Example: Compare metrics for one employee
  new Chart(ctx, {
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
          max: 5,
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
  if(vm.token) vm.fetchEmployees();

}]);
