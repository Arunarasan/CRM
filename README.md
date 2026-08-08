# CRM - Customer Relationship Management System

A full-stack enterprise CRM system tailored for project workflows, stages, measurements, checklists, quotations, and client management.

---

## 🏗 Tech Stack

- **Backend**: Java 17+, Spring Boot, Spring Security, JPA/Hibernate, PostgreSQL/MySQL
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, Shadcn UI
- **Architecture**: RESTful API, Modular Services, Role-Based Access Control (RBAC)

---

## 📁 Repository Structure

```
CRM/
├── backend/                  # Spring Boot backend application
│   ├── src/main/java/        # Java source code (controllers, services, entities, security)
│   ├── src/main/resources/   # Configuration files and DB migrations
│   ├── pom.xml               # Maven configuration
│   └── .env.example          # Sample environment variables
├── frontend/                 # React frontend application
│   ├── src/                  # React components, pages, hooks, state
│   ├── package.json          # Node dependencies & scripts
│   ├── vite.config.ts        # Vite configuration
│   └── tailwind.config.js    # Tailwind CSS configuration
├── API_DOCUMENTATION.md      # Comprehensive API endpoint specs
├── BACKEND_STRUCTURE.md      # Backend architecture breakdown
├── FRONTEND_STRUCTURE.md     # Frontend component & route breakdown
├── BUSINESS_WORKFLOW.md      # Business lifecycle & workflow diagrams
├── PROJECT_ARCHITECTURE.md   # System architecture & data flow
└── SECURITY_AUDIT.md         # Security specifications & best practices
```

---

## 🚀 Getting Started

### 1. Backend Setup

```bash
cd backend
# Copy sample environment configuration
cp .env.example .env

# Build and run with Maven
./mvnw spring-boot:run
```

### 2. Frontend Setup

```bash
cd frontend
# Install dependencies
npm install

# Start local development server
npm run dev
```

---

## 📖 Documentation

Detailed architectural and workflow documentation:
- [API Documentation](API_DOCUMENTATION.md)
- [Backend Structure](BACKEND_STRUCTURE.md)
- [Frontend Structure](FRONTEND_STRUCTURE.md)
- [Business Workflow](BUSINESS_WORKFLOW.md)
- [Project Architecture](PROJECT_ARCHITECTURE.md)
- [Security Audit](SECURITY_AUDIT.md)

---

## 📄 License

This project is proprietary and confidential.
