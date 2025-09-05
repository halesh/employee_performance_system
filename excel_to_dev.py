import pandas as pd
from app import db, app
from models import User, Employee, RoleEnum
from passlib.hash import pbkdf2_sha256 as hasher

# Load Excel file (update path)
df = pd.read_excel("CSG_TEAM.xlsx", sheet_name="Employees")

# Track created users & employees
name_to_user = {}
name_to_employee = {}

with app.app_context():
    # Step 1: Create Users (for managers) and Employees
    for _, row in df.iterrows():
        # import pdb; pdb.set_trace()
        name = str(row["Name"]).strip()
        email = str(row["Email ID"]).strip()
        designation = str(row["Designation"]).strip()
        manager_name = str(row["Reporting Manager"]).strip() if not pd.isna(row["Reporting Manager"]) else None

        # Create User if the person is a Manager/Director

        user = User(
            email=email,
            role=RoleEnum.MANAGER,   # or RoleEnum.ADMIN for higher roles
        )
        user.set_password("default123")  # set default password
        db.session.add(user)
        db.session.flush()   # assign user.id
        name_to_user[name] = user

        # Create Employee (link later to manager)
        employee = Employee(
            name=name,
            email=email,
            designation=designation,
            manager_id=None  # will assign later
        )
        db.session.add(employee)
        db.session.flush()

        name_to_employee[name] = {
            "employee": employee,
            "manager_name": manager_name
        }

    # Step 2: Link employees to their manager's User.id
    for name, data in name_to_employee.items():
        employee = data["employee"]
        manager_name = data["manager_name"]

        if manager_name and manager_name in name_to_user:
            employee.manager_id = name_to_user[manager_name].id

    db.session.commit()
print("✅ Employees and Users seeded successfully from Excel!")
