import os
class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-me')
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///employee_perf.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_EXP_DELTA_SECONDS = int(os.environ.get('JWT_EXP_DELTA_SECONDS', 86400))
    STATIC_FOLDER = "static"