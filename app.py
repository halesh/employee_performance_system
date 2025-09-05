import os
from flask import Flask, send_from_directory
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='static', static_url_path='/static')
app.config.from_object('config.Config')

# Initialize extensions & blueprints
from models import db
db.init_app(app)

from api import api_bp
app.register_blueprint(api_bp, url_prefix='/api')

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    # Serve the SPA entry point
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

# CLI utility to create DB and seed data
@app.cli.command('db_init')
def db_init():
    from models import db, User, Employee, MetricEntry
    from seed_data import seed
    with app.app_context():
        db.drop_all()
        db.create_all()
        seed(db)
        print('Database initialized and seeded.')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
