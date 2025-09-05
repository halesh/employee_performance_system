from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from passlib.hash import pbkdf2_sha256 as hasher
import enum
db = SQLAlchemy()

class RoleEnum(str, enum.Enum):
    ADMIN = 'admin'
    MANAGER = 'manager'

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.Enum(RoleEnum), nullable=False)

    def set_password(self, password):
        self.password_hash = hasher.hash(password)
    def verify_password(self, password):
        return hasher.verify(password, self.password_hash)

class Employee(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    designation = db.Column(db.String(120), nullable=False)
    manager_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)

class MetricEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employee.id'), nullable=False)
    employee = db.relationship('Employee', backref='metrics')
    metric_key = db.Column(db.String(64), nullable=False)
    score = db.Column(db.Float, nullable=False)  # 0-100
    comment = db.Column(db.String(400), nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    month_year = db.Column(db.String(20), default=lambda: datetime.utcnow().strftime("%B %Y"))
