import os, datetime, functools
from sqlalchemy import func
from flask import Blueprint, request, jsonify, current_app
from models import db, User, Employee, MetricEntry, RoleEnum
import jwt

api_bp = Blueprint('api', __name__)

def generate_token(user):
    payload = {
        'sub': user.id,
        'role': user.role.value,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(seconds=current_app.config['JWT_EXP_DELTA_SECONDS'])
    }
    token = jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')
    return token

def auth_required(role=None):
    def decorator(f):
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            auth = request.headers.get('Authorization', None)
            if not auth or not auth.startswith('Bearer '):
                return jsonify({'error':'missing token'}), 401
            token = auth.split(' ',1)[1]
            try:
                data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
            except Exception as e:
                return jsonify({'error':'invalid token', 'msg':str(e)}), 401
            request.user_id = data['sub']
            request.user_role = data['role']
            if role and request.user_role != role:
                return jsonify({'error':'forbidden - role required: ' + role}), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator

@api_bp.route('/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    email = data.get('email')
    password = data.get('password')
    if not email or not password:
        return jsonify({'error':'email & password required'}), 400
    user = User.query.filter_by(email=email).first()
    if not user or not user.verify_password(password):
        return jsonify({'error':'invalid credentials'}), 401
    token = generate_token(user)
    return jsonify({'token': token, 'role': user.role.value})

@api_bp.route('/auth/change_password', methods=['POST'])
@auth_required()
def change_password():
    data = request.json or {}
    current = data.get('current_password')
    new = data.get('new_password')
    if not current or not new:
        return jsonify({'error': 'current_password & new_password required'}), 400
    user = User.query.get(request.user_id)
    if not user or not user.verify_password(current):
        return jsonify({'error': 'current password is incorrect'}), 400
    # Optional: basic password policy
    if len(new) < 6:
        return jsonify({'error': 'new password must be at least 6 characters'}), 400
    user.set_password(new)
    db.session.commit()
    return jsonify({'message': 'password updated successfully'})

@api_bp.route('/me', methods=['GET'])
@auth_required()
def me():
    user = User.query.get(request.user_id)
    return jsonify({'id': user.id, 'email': user.email, 'role': user.role.value})

# Summary for dashboard: logged-in user details + reportees info
@api_bp.route('/me/summary', methods=['GET'])
@auth_required()
def me_summary():
    user = User.query.get(request.user_id)
    # Try to map a User to an Employee by email (if exists)
    employee = Employee.query.filter_by(email=user.email).first()

    # For managers, get reportees (employees with manager_id = user.id)
    reportees = []
    if user.role == RoleEnum.MANAGER:
        team = Employee.query.filter_by(manager_id=user.id).all()
        reportees = [{
            'id': e.id,
            'name': e.name,
            'email': e.email,
            'designation': e.designation
        } for e in team]

    payload = {
        'id': user.id,
        'email': user.email,
        'role': user.role.value,
        'employee': ({
            'id': employee.id,
            'name': employee.name,
            'designation': employee.designation
        } if employee else None),
        'reportees_count': len(reportees),
        'reportees': reportees
    }
    return jsonify(payload)

# Employee CRUD (Admin + Manager limited)
@api_bp.route('/employees', methods=['GET'])
@auth_required()
def list_employees():
    # Admin sees all; manager sees subordinates only
    if request.user_role == RoleEnum.ADMIN.value:
        emps = Employee.query.all()
    else:
        emps = Employee.query.filter_by(manager_id=request.user_id).all()
    out = []
    for e in emps:
        out.append({'id': e.id,
                    'name': e.name,
                    'email': e.email,
                    'manager_id': e.manager_id,
                    'designation': e.designation})
    return jsonify(out)

@api_bp.route('/employees', methods=['POST'])
@auth_required()
def add_employee():
    data = request.json or {}
    name = data.get('name')
    email = data.get('email')
    designation = data.get('designation')
    manager_id = data.get('manager_id')

    # If employee is a manager, also create a User account
    if data.get('is_manager'):
        user = User(email=data['email'], role=RoleEnum.MANAGER)
        user.set_password(data['password'])
        db.session.add(user)
        db.session.flush()

    if not name or not email:
        return jsonify({'error':'name & email required'}), 400
    # Only admin or manager (manager can only add under themselves)

    emp = Employee(name=name, email=email, designation=designation, manager_id=manager_id)
    db.session.add(emp)
    db.session.commit()
    return jsonify({'id': emp.id, 'name': emp.name}), 201

@api_bp.route('/employees/<int:eid>', methods=['PUT'])
@auth_required()
def edit_employee(eid):
    emp = Employee.query.get_or_404(eid)
    # Manager can only edit their subordinates
    if request.user_role == RoleEnum.MANAGER.value and emp.manager_id != request.user_id:
        return jsonify({'error':'forbidden'}), 403
    data = request.json or {}
    emp.name = data.get('name', emp.name)
    emp.email = data.get('email', emp.email)
    emp.manager_id = data.get('manager_id', emp.manager_id)
    db.session.commit()
    return jsonify({'id': emp.id, 'name': emp.name})

# Metrics endpoints
@api_bp.route('/employees/<int:eid>/metrics', methods=['GET'])
@auth_required()
def get_metrics(eid):
    emp = Employee.query.get_or_404(eid)
    if request.user_role == RoleEnum.MANAGER.value and emp.manager_id != request.user_id:
        return jsonify({'error':'forbidden'}), 403
    month = request.args.get('month')  # e.g. "2025-08"
    query = MetricEntry.query.filter_by(employee_id=eid)
    if month:
        query = query.filter(MetricEntry.month_year == month)
    metrics = query.all()
    # Serialize the filtered metrics (do not use emp.metrics here, as it ignores the filter)
    metrics = [
        {
            'id': m.id,
            'metric_key': m.metric_key,
            'score': m.score,
            'comment': m.comment,
            'month': m.month_year
        }
        for m in metrics
    ]
    return jsonify(metrics)

@api_bp.route('/employees/<int:eid>/metrics', methods=['POST'])
@auth_required()
def add_metric(eid):
    emp = Employee.query.get_or_404(eid)
    # Manager can only add for subordinates
    if request.user_role == RoleEnum.MANAGER.value and emp.manager_id != request.user_id:
        return jsonify({'error':'forbidden'}), 403
    data = request.json or {}
    for d in data:
        metric_key = d.get('metric_key')
        score = d.get('score')
        comment = d.get('comment')
        m = MetricEntry(employee=emp, metric_key=metric_key, score=float(score), comment=comment)
        db.session.add(m)
    db.session.commit()
    return jsonify({'id': m.id, 'metric_key': m.metric_key}), 201

@api_bp.route('/team/aggregate', methods=['GET'])
@auth_required(role=RoleEnum.ADMIN.value)
def team_aggregate():
    # Returns aggregated weighted scores per employee and a ranking list
    # Metric weights - as specified
    weights = {
        'quality_of_work': 0.20,
        'dependability': 0.10,
        'initiative': 0.10,
        'adaptability': 0.10,
        'compliance': 0.10,
        'interpersonal': 0.10,
        'time_management': 0.10,
        'communication': 0.10,
        'self_improvement': 0.10
    }
    employees = Employee.query.all()
    result = []
    for e in employees:
        # compute average per metric_key
        scores = {}
        for k in weights.keys():
            entries = MetricEntry.query.filter_by(employee_id=e.id, metric_key=k).all()
            if entries:
                scores[k] = sum([it.score for it in entries]) / len(entries)
            else:
                scores[k] = None
        # weighted average (ignore None metrics)
        total_weight=0; weighted_sum=0
        for k,w in weights.items():
            if scores[k] is not None:
                weighted_sum += scores[k]*w
                total_weight += w
        final = weighted_sum/(total_weight) if total_weight>0 else None
        result.append({'employee_id': e.id, 'name': e.name, 'scores': scores, 'final_score': final})
    # sort by final_score desc (None last)
    result_sorted = sorted(result, key=lambda x: (x['final_score'] is None, -(x['final_score'] or 0)))
    return jsonify(result_sorted)

@api_bp.route('/api/metrics/months', methods=['GET'])
def get_available_months():
    months = db.session.query(MetricEntry.month_year.label('month_year')).distinct().all()
    return jsonify({"months": months})
