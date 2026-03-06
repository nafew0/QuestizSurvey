#!/bin/bash

# PostgreSQL Database Setup Script for Mac
# This script creates a PostgreSQL database and user for the project

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        PostgreSQL Database Setup (Mac)                ║${NC}"
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

# Check if PostgreSQL is installed
check_postgres() {
    print_info "Checking PostgreSQL installation..."

    if ! command -v psql &> /dev/null; then
        print_error "PostgreSQL is not installed"
        echo ""
        print_info "To install PostgreSQL on Mac, run:"
        echo "  brew install postgresql@14"
        echo "  brew services start postgresql@14"
        exit 1
    fi

    print_success "PostgreSQL is installed"
}

# Check if PostgreSQL is running
check_postgres_running() {
    print_info "Checking if PostgreSQL is running..."

    if ! pg_isready -q; then
        print_error "PostgreSQL is not running"
        echo ""
        print_info "To start PostgreSQL, run:"
        echo "  brew services start postgresql@14"
        echo "  OR"
        echo "  pg_ctl -D /usr/local/var/postgres start"
        exit 1
    fi

    print_success "PostgreSQL is running"
}

# Get user inputs
get_inputs() {
    echo ""
    print_info "Database Configuration"
    echo ""

    read -p "$(echo -e ${BLUE}Enter database name: ${NC})" DB_NAME
    while [ -z "$DB_NAME" ]; do
        print_warning "Database name cannot be empty"
        read -p "$(echo -e ${BLUE}Enter database name: ${NC})" DB_NAME
    done

    read -p "$(echo -e ${BLUE}Enter database user [postgres]: ${NC})" DB_USER
    DB_USER=${DB_USER:-postgres}

    read -sp "$(echo -e ${BLUE}Enter database password [leave empty for no password]: ${NC})" DB_PASSWORD
    echo ""

    read -p "$(echo -e ${BLUE}Enter database host [localhost]: ${NC})" DB_HOST
    DB_HOST=${DB_HOST:-localhost}

    read -p "$(echo -e ${BLUE}Enter database port [5432]: ${NC})" DB_PORT
    DB_PORT=${DB_PORT:-5432}

    echo ""
    print_info "Database Configuration Summary:"
    echo "  Database Name: $DB_NAME"
    echo "  Database User: $DB_USER"
    echo "  Database Host: $DB_HOST"
    echo "  Database Port: $DB_PORT"
    echo ""

    read -p "$(echo -e ${YELLOW}Is this correct? [y/N]: ${NC})" CONFIRM
    if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
        print_error "Setup cancelled by user"
        exit 1
    fi
}

# Create database
create_database() {
    print_info "Creating database..."

    # Check if database exists
    if [ -n "$DB_PASSWORD" ]; then
        DB_EXISTS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw $DB_NAME && echo "yes" || echo "no")
    else
        DB_EXISTS=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw $DB_NAME && echo "yes" || echo "no")
    fi

    if [ "$DB_EXISTS" == "yes" ]; then
        print_warning "Database '$DB_NAME' already exists"
        read -p "$(echo -e ${YELLOW}Do you want to drop and recreate it? [y/N]: ${NC})" DROP_DB

        if [[ $DROP_DB =~ ^[Yy]$ ]]; then
            print_warning "Dropping database '$DB_NAME'..."
            if [ -n "$DB_PASSWORD" ]; then
                PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "DROP DATABASE IF EXISTS $DB_NAME;"
            else
                psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "DROP DATABASE IF EXISTS $DB_NAME;"
            fi
            print_success "Database dropped"
        else
            print_info "Keeping existing database"
            return 0
        fi
    fi

    # Create database
    print_info "Creating database '$DB_NAME'..."
    if [ -n "$DB_PASSWORD" ]; then
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "CREATE DATABASE $DB_NAME;"
    else
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "CREATE DATABASE $DB_NAME;"
    fi

    print_success "Database '$DB_NAME' created successfully"
}

# Create database user (if needed)
create_user() {
    if [ "$DB_USER" == "postgres" ]; then
        print_info "Using default 'postgres' user"
        return 0
    fi

    print_info "Checking if user '$DB_USER' exists..."

    # Check if user exists
    if [ -n "$DB_PASSWORD" ]; then
        USER_EXISTS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null)
    else
        USER_EXISTS=$(psql -h $DB_HOST -p $DB_PORT -U postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null)
    fi

    if [ "$USER_EXISTS" == "1" ]; then
        print_warning "User '$DB_USER' already exists"
        return 0
    fi

    print_info "Creating user '$DB_USER'..."
    if [ -n "$DB_PASSWORD" ]; then
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
        psql -h $DB_HOST -p $DB_PORT -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    else
        psql -h $DB_HOST -p $DB_PORT -U postgres -c "CREATE USER $DB_USER;"
        psql -h $DB_HOST -p $DB_PORT -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    fi

    print_success "User '$DB_USER' created successfully"
}

# Test connection
test_connection() {
    print_info "Testing database connection..."

    if [ -n "$DB_PASSWORD" ]; then
        if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c '\q' 2>/dev/null; then
            print_success "Database connection successful"
        else
            print_error "Failed to connect to database"
            exit 1
        fi
    else
        if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c '\q' 2>/dev/null; then
            print_success "Database connection successful"
        else
            print_error "Failed to connect to database"
            exit 1
        fi
    fi
}

# Print final instructions
print_instructions() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║        Database Setup Complete! 🎉                     ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    print_info "Database Configuration:"
    echo "  Database Name: $DB_NAME"
    echo "  Database User: $DB_USER"
    echo "  Database Host: $DB_HOST"
    echo "  Database Port: $DB_PORT"
    echo ""
    print_info "Connection String:"
    if [ -n "$DB_PASSWORD" ]; then
        echo "  postgresql://$DB_USER:****@$DB_HOST:$DB_PORT/$DB_NAME"
    else
        echo "  postgresql://$DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
    fi
    echo ""
    print_info "Update your .env file with these values:"
    echo "  DB_NAME=$DB_NAME"
    echo "  DB_USER=$DB_USER"
    if [ -n "$DB_PASSWORD" ]; then
        echo "  DB_PASSWORD=$DB_PASSWORD"
    fi
    echo "  DB_HOST=$DB_HOST"
    echo "  DB_PORT=$DB_PORT"
    echo ""
    print_success "You can now run Django migrations!"
}

# Main execution
main() {
    check_postgres
    check_postgres_running
    get_inputs
    create_database
    create_user
    test_connection
    print_instructions
}

# Run main function
main
