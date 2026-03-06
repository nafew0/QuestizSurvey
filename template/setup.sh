#!/bin/bash

# Django + React Project Setup Script
# This script sets up a new Django + React project with authentication
# Based on template from AniFight project

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Django + React Project Setup with Authentication    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check if required commands are available
check_requirements() {
    print_info "Checking system requirements..."

    command -v python3 >/dev/null 2>&1 || { print_error "Python3 is required but not installed. Aborting."; exit 1; }
    command -v npm >/dev/null 2>&1 || { print_error "Node.js/npm is required but not installed. Aborting."; exit 1; }
    command -v psql >/dev/null 2>&1 || { print_error "PostgreSQL is required but not installed. Aborting."; exit 1; }

    print_success "All required commands are available"
}

# Get user inputs
get_user_inputs() {
    echo ""
    print_info "Please provide the following information:"
    echo ""

    # Project name
    read -p "$(echo -e ${BLUE}Enter project name [my_project]: ${NC})" PROJECT_NAME
    PROJECT_NAME=${PROJECT_NAME:-my_project}

    # Database name
    read -p "$(echo -e ${BLUE}Enter database name [${PROJECT_NAME}_db]: ${NC})" DB_NAME
    DB_NAME=${DB_NAME:-${PROJECT_NAME}_db}

    # Database user
    read -p "$(echo -e ${BLUE}Enter database user [postgres]: ${NC})" DB_USER
    DB_USER=${DB_USER:-postgres}

    # Database password
    read -sp "$(echo -e ${BLUE}Enter database password [postgres]: ${NC})" DB_PASSWORD
    echo ""
    DB_PASSWORD=${DB_PASSWORD:-postgres}

    # Database host
    read -p "$(echo -e ${BLUE}Enter database host [localhost]: ${NC})" DB_HOST
    DB_HOST=${DB_HOST:-localhost}

    # Database port
    read -p "$(echo -e ${BLUE}Enter database port [5432]: ${NC})" DB_PORT
    DB_PORT=${DB_PORT:-5432}

    # Project directory
    read -p "$(echo -e ${BLUE}Enter project directory path [$(pwd)/${PROJECT_NAME}]: ${NC})" PROJECT_DIR
    PROJECT_DIR=${PROJECT_DIR:-$(pwd)/${PROJECT_NAME}}

    # Django secret key - generate without Django dependency
    DJANGO_SECRET_KEY=$(python3 -c 'import secrets; import string; chars = string.ascii_letters + string.digits + "!@#$%^&*(-_=+)"; print("".join(secrets.choice(chars) for _ in range(50)))')

    echo ""
    print_info "Summary of your inputs:"
    echo "  Project Name: $PROJECT_NAME"
    echo "  Database Name: $DB_NAME"
    echo "  Database User: $DB_USER"
    echo "  Database Host: $DB_HOST"
    echo "  Database Port: $DB_PORT"
    echo "  Project Directory: $PROJECT_DIR"
    echo ""

    read -p "$(echo -e ${YELLOW}Is this correct? [y/N]: ${NC})" CONFIRM
    if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
        print_error "Setup cancelled by user"
        exit 1
    fi
}

# Create project directory
create_project_directory() {
    print_info "Creating project directory..."

    if [ -d "$PROJECT_DIR" ]; then
        print_warning "Directory $PROJECT_DIR already exists"
        read -p "$(echo -e ${YELLOW}Do you want to continue? This may overwrite existing files. [y/N]: ${NC})" OVERWRITE
        if [[ ! $OVERWRITE =~ ^[Yy]$ ]]; then
            print_error "Setup cancelled by user"
            exit 1
        fi
    else
        mkdir -p "$PROJECT_DIR"
    fi

    print_success "Project directory created/verified"
}

# Copy template files
copy_template_files() {
    print_info "Copying template files..."

    TEMPLATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    # Copy backend
    cp -r "$TEMPLATE_DIR/backend" "$PROJECT_DIR/"

    # Copy frontend
    cp -r "$TEMPLATE_DIR/frontend" "$PROJECT_DIR/"

    # Rename Django project folder
    mv "$PROJECT_DIR/backend/{{PROJECT_NAME}}" "$PROJECT_DIR/backend/$PROJECT_NAME"

    print_success "Template files copied"
}

# Replace placeholders in files
replace_placeholders() {
    print_info "Replacing placeholders in files..."

    # Find and replace in all files
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        find "$PROJECT_DIR" -type f \( -name "*.py" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" -o -name "*.html" -o -name "*.md" -o -name ".env*" \) -exec sed -i '' "s/{{PROJECT_NAME}}/$PROJECT_NAME/g" {} +
        find "$PROJECT_DIR" -type f \( -name "*.py" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" -o -name "*.html" -o -name "*.md" -o -name ".env*" \) -exec sed -i '' "s/{{DB_NAME}}/$DB_NAME/g" {} +
    else
        # Linux
        find "$PROJECT_DIR" -type f \( -name "*.py" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" -o -name "*.html" -o -name "*.md" -o -name ".env*" \) -exec sed -i "s/{{PROJECT_NAME}}/$PROJECT_NAME/g" {} +
        find "$PROJECT_DIR" -type f \( -name "*.py" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" -o -name "*.html" -o -name "*.md" -o -name ".env*" \) -exec sed -i "s/{{DB_NAME}}/$DB_NAME/g" {} +
    fi

    print_success "Placeholders replaced"
}

# Create .env files
create_env_files() {
    print_info "Creating .env files..."

    # Backend .env
    cat > "$PROJECT_DIR/backend/.env" << EOF
# Django settings
DJANGO_SECRET_KEY=$DJANGO_SECRET_KEY
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database settings
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT

# Redis settings
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
EOF

    # Frontend .env
    cat > "$PROJECT_DIR/frontend/.env" << EOF
VITE_API_URL=http://localhost:8000/api
EOF

    print_success ".env files created"
}

# Setup backend
setup_backend() {
    print_info "Setting up Django backend..."

    cd "$PROJECT_DIR/backend"

    # Create virtual environment
    print_info "Creating Python virtual environment..."
    python3 -m venv venv

    # Activate virtual environment
    source venv/bin/activate

    # Upgrade pip
    print_info "Upgrading pip..."
    pip install --upgrade pip

    # Install requirements
    print_info "Installing Python dependencies..."
    pip install -r requirements.txt

    print_success "Backend setup complete"
}

# Setup database
setup_database() {
    print_info "Setting up PostgreSQL database..."

    # Check if database exists
    DB_EXISTS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME && echo "yes" || echo "no")

    if [ "$DB_EXISTS" == "yes" ]; then
        print_warning "Database $DB_NAME already exists"
        read -p "$(echo -e ${YELLOW}Do you want to drop and recreate it? [y/N]: ${NC})" DROP_DB
        if [[ $DROP_DB =~ ^[Yy]$ ]]; then
            PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "DROP DATABASE $DB_NAME;"
            print_success "Database dropped"
        else
            print_info "Using existing database"
            return
        fi
    fi

    # Create database
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "CREATE DATABASE $DB_NAME;"

    print_success "Database created"
}

# Run migrations
run_migrations() {
    print_info "Running Django migrations..."

    cd "$PROJECT_DIR/backend"
    source venv/bin/activate

    python manage.py makemigrations
    python manage.py migrate

    print_success "Migrations complete"
}

# Create superuser
create_superuser() {
    print_info "Creating Django superuser..."
    echo ""
    print_warning "You will be prompted to create a superuser account"

    cd "$PROJECT_DIR/backend"
    source venv/bin/activate

    python manage.py createsuperuser

    print_success "Superuser created"
}

# Setup frontend
setup_frontend() {
    print_info "Setting up React frontend..."

    cd "$PROJECT_DIR/frontend"

    # Install npm packages
    print_info "Installing npm dependencies (this may take a few minutes)..."
    npm install

    print_success "Frontend setup complete"
}

# Create start scripts
create_start_scripts() {
    print_info "Creating start scripts..."

    # Backend start script
    cat > "$PROJECT_DIR/start_backend.sh" << 'EOF'
#!/bin/bash
cd backend
source venv/bin/activate
python manage.py runserver 8000
EOF

    # Frontend start script
    cat > "$PROJECT_DIR/start_frontend.sh" << 'EOF'
#!/bin/bash
cd frontend
npm run dev
EOF

    # Combined start script
    cat > "$PROJECT_DIR/start.sh" << 'EOF'
#!/bin/bash

# Start backend in background
./start_backend.sh &
BACKEND_PID=$!

# Start frontend in background
./start_frontend.sh &
FRONTEND_PID=$!

echo "Backend running on http://localhost:8000"
echo "Frontend running on http://localhost:5555"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user interrupt
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
EOF

    chmod +x "$PROJECT_DIR/start_backend.sh"
    chmod +x "$PROJECT_DIR/start_frontend.sh"
    chmod +x "$PROJECT_DIR/start.sh"

    print_success "Start scripts created"
}

# Print final instructions
print_final_instructions() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║             Setup Complete! 🎉                         ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    print_info "Your project is ready at: $PROJECT_DIR"
    echo ""
    print_info "To start your project:"
    echo "  1. Start backend:  ./start_backend.sh"
    echo "  2. Start frontend: ./start_frontend.sh"
    echo "  3. Or both:        ./start.sh"
    echo ""
    print_info "Useful commands:"
    echo "  Backend:  cd $PROJECT_DIR/backend && source venv/bin/activate"
    echo "  Frontend: cd $PROJECT_DIR/frontend && npm run dev"
    echo ""
    print_info "URLs:"
    echo "  Frontend:       http://localhost:5555"
    echo "  Backend API:    http://localhost:8000/api"
    echo "  Django Admin:   http://localhost:8000/admin"
    echo ""
    print_info "Next steps:"
    echo "  1. Review the README.md file for detailed documentation"
    echo "  2. Customize the project to your needs"
    echo "  3. Start building your application!"
    echo ""
    print_success "Happy coding! 🚀"
}

# Main execution
main() {
    check_requirements
    get_user_inputs
    create_project_directory
    copy_template_files
    replace_placeholders
    create_env_files
    setup_database
    setup_backend
    run_migrations

    echo ""
    read -p "$(echo -e ${BLUE}Do you want to create a superuser now? [Y/n]: ${NC})" CREATE_SU
    if [[ ! $CREATE_SU =~ ^[Nn]$ ]]; then
        create_superuser
    else
        print_info "You can create a superuser later with: python manage.py createsuperuser"
    fi

    setup_frontend
    create_start_scripts
    print_final_instructions
}

# Run main function
main
