from models import User, Employee, MetricEntry, RoleEnum
def seed(db):
    # Create default admin and manager
    admin = User(email='admin@example.com', role=RoleEnum.ADMIN)
    admin.set_password('AdminPass123')
    mgr = User(email='manager@example.com', role=RoleEnum.MANAGER)
    mgr.set_password('ManagerPass123')
    db.session.add_all([admin, mgr])
    db.session.commit()
