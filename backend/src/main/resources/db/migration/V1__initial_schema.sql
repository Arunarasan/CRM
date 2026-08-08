-- V1__initial_schema.sql
-- Baseline CRM schema as it existed immediately before Flyway was introduced
-- (originally created by Hibernate ddl-auto; Flyway migrations started at V2, which
-- ALTERed already-existing tables and so failed on a fresh empty database).
--
-- This baseline was derived MECHANICALLY, not guessed: the authoritative DDL that
-- Hibernate expects for the current entity model is produced offline by
-- com.arudra.crm.SchemaGenTest (no DB required, exact MySQLDialect), and every table
-- or column that migrations V2..V26 create or add is then removed from it. The result
-- is that applying V1 followed by V2..V26 reproduces EXACTLY the schema Hibernate
-- validates against (spring.jpa.hibernate.ddl-auto=validate).
--
-- Column definitions/types are copied verbatim from Hibernate's own generated DDL, so
-- `validate` matches by construction. Do not hand-edit; if the entity model changes,
-- add a new Vn migration rather than altering this baseline.

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE activity_logs (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    action varchar(50) not null,
    browser varchar(255),
    company_id bigint,
    description TEXT,
    device varchar(255),
    entity_id bigint not null,
    entity_name varchar(100),
    ip_address varchar(50),
    module varchar(100) not null,
    new_value JSON,
    old_value JSON,
    operating_system varchar(100),
    performed_at datetime(6),
    performed_by varchar(100),
    performed_role varchar(50),
    request_id varchar(100),
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE attendance (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    check_in_time time(6),
    check_out_time time(6),
    date date not null,
    remarks TEXT,
    status varchar(20) not null,
    employee_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE boq_activity_logs (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    action_time datetime(6),
    action_type varchar(100),
    description TEXT,
    performed_by varchar(100),
    role varchar(100),
    boq_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE boq_change_logs (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    change_type varchar(50) not null,
    field_name varchar(100),
    modified_date datetime(6) not null,
    new_value TEXT,
    previous_value TEXT,
    reason TEXT,
    revision_number integer,
    boq_id bigint not null,
    boq_item_id bigint,
    boq_phase_id bigint,
    modified_by_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE boq_item_labours (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    amount decimal(15,2),
    contractor_name varchar(255),
    labour_category varchar(100),
    quantity decimal(15,2),
    rate decimal(15,2),
    remarks TEXT,
    work_type varchar(100),
    item_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE boq_item_materials (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    amount decimal(15,2),
    cost_price decimal(15,2),
    final_quantity decimal(15,2),
    material_name varchar(255) not null,
    quantity decimal(15,2),
    remarks TEXT,
    selling_rate decimal(15,2),
    unit varchar(20),
    vendor varchar(255),
    waste_percent decimal(5,2),
    item_id bigint not null,
    product_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE boq_items (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    amount decimal(15,2),
    area decimal(15,2),
    category varchar(50),
    description TEXT,
    floor_name varchar(100),
    height decimal(15,2),
    is_active bit not null,
    item_code varchar(50),
    item_name varchar(255) not null,
    labour_total decimal(15,2),
    length decimal(15,2),
    material_total decimal(15,2),
    measurement_item_id bigint,
    measurement_room_id bigint,
    origin_item_id bigint,
    perimeter decimal(15,2),
    quantity decimal(15,2),
    remarks TEXT,
    room_name varchar(100),
    status varchar(20),
    unit varchar(20),
    width decimal(15,2),
    boq_id bigint not null,
    phase_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE boq_phases (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    budget decimal(15,2),
    completion_percent integer,
    is_active bit not null,
    phase_name varchar(200) not null,
    quotation_id bigint,
    sequence integer not null,
    status varchar(20),
    boq_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE boqs (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    approved_date datetime(6),
    boq_number varchar(50),
    discount decimal(15,2),
    discount_amount decimal(15,2),
    discount_type varchar(20),
    grand_total decimal(15,2),
    is_latest_version bit,
    labour_total decimal(15,2),
    material_total decimal(15,2),
    notes TEXT,
    parent_boq_id bigint,
    property_name varchar(200),
    quotation_mode varchar(20),
    rejection_reason TEXT,
    revision_number integer,
    status varchar(50),
    subtotal decimal(15,2),
    tax_amount decimal(15,2),
    tax_percent decimal(5,2),
    approved_by_id bigint,
    created_by_id bigint,
    customer_id bigint,
    measurement_id bigint,
    project_id bigint,
    quotation_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE contact_persons (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    designation varchar(100),
    email varchar(100),
    is_primary bit,
    name varchar(100) not null,
    notes TEXT,
    phone varchar(20),
    whatsapp varchar(20),
    customer_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE contractor_attendance (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    date date not null,
    hours_worked decimal(5,2),
    status varchar(50) not null,
    contractor_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE contractor_documents (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    file_name varchar(200) not null,
    file_url varchar(500) not null,
    type varchar(50) not null,
    contractor_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE contractor_payments (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    amount decimal(15,2) not null,
    invoice_url varchar(500),
    payment_date date,
    reference_number varchar(100),
    status varchar(50) not null,
    contractor_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE contractor_projects (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    assigned_date date,
    status varchar(50),
    contractor_id bigint not null,
    project_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE contractors (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    company_name varchar(255),
    daily_rate decimal(10,2),
    email varchar(255),
    hourly_rate decimal(10,2),
    name varchar(255) not null,
    performance_rating integer,
    phone varchar(50),
    skills TEXT,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE credit_debit_notes (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    amount decimal(15,2) not null,
    date date not null,
    note_number varchar(50) not null,
    reason TEXT,
    type varchar(20) not null,
    customer_id bigint not null,
    invoice_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE customer_activities (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    action varchar(100) not null,
    attachment_file_name varchar(200),
    attachment_url varchar(500),
    channel varchar(50),
    customer_mood varchar(20),
    customer_response TEXT,
    description TEXT,
    outcome varchar(200),
    customer_id bigint not null,
    performed_by_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE customer_addresses (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    address TEXT,
    city varchar(100),
    is_primary bit,
    label varchar(50) not null,
    pincode varchar(20),
    state varchar(100),
    customer_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE customer_documents (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    file_name varchar(255) not null,
    file_type varchar(50),
    file_url varchar(500) not null,
    customer_id bigint not null,
    uploaded_by_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE customer_followups (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    completion_notes TEXT,
    followup_date date not null,
    followup_time time(6),
    method varchar(50),
    next_followup_date date,
    notes TEXT,
    priority varchar(20),
    purpose varchar(255),
    status varchar(20) not null,
    assigned_employee_id bigint,
    created_by_user_id bigint,
    customer_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE customer_notes (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    content TEXT not null,
    note_type varchar(100),
    author_id bigint not null,
    customer_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE customer_payments (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    amount decimal(15,2) not null,
    payment_date date not null,
    payment_method varchar(50),
    payment_number varchar(50) not null,
    reference_number varchar(100),
    customer_id bigint not null,
    invoice_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE customer_tags (
    customer_id bigint not null,
    tag_id bigint not null,
    primary key (customer_id, tag_id)
) ENGINE=InnoDB;

CREATE TABLE customers (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    alternate_phone varchar(20),
    billing_address TEXT,
    city varchar(100),
    company_name varchar(200),
    contact_person_name varchar(100),
    country varchar(100),
    credit_limit decimal(15,2),
    customer_code varchar(50),
    customer_since date,
    customer_type varchar(50),
    district varchar(100),
    email varchar(100),
    google_map_location varchar(500),
    gst_number varchar(50),
    latitude float(53),
    longitude float(53),
    name varchar(100) not null,
    pan_number varchar(50),
    payment_terms varchar(200),
    phone varchar(20),
    photo_url varchar(500),
    pincode varchar(20),
    preferred_contact_method varchar(50),
    preferred_language varchar(50),
    site_address TEXT,
    state varchar(100),
    status varchar(50),
    website varchar(200),
    whatsapp_number varchar(20),
    assigned_employee_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE departments (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    description TEXT,
    name varchar(100) not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE employee_documents (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    document_name varchar(150) not null,
    document_type varchar(50) not null,
    file_url varchar(500) not null,
    uploaded_date date,
    employee_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE employees (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    base_salary decimal(15,2),
    date_of_joining date not null,
    designation varchar(100),
    email varchar(150) not null,
    emergency_contact_name varchar(100),
    emergency_contact_phone varchar(20),
    employee_code varchar(50) not null,
    first_name varchar(100) not null,
    last_name varchar(100) not null,
    phone varchar(20),
    profile_photo_url varchar(500),
    status varchar(20) not null,
    department_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE expenses (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    amount decimal(15,2) not null,
    category varchar(100) not null,
    date date not null,
    description TEXT,
    payment_method varchar(50),
    reference_number varchar(100),
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE goods_receipt_note_items (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    accepted_quantity integer not null,
    received_quantity integer not null,
    rejected_quantity integer not null,
    grn_id bigint not null,
    product_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE goods_receipt_notes (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    date datetime(6) not null,
    grn_number varchar(50) not null,
    notes TEXT,
    received_by varchar(100),
    status varchar(50) not null,
    purchase_order_id bigint not null,
    warehouse_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE inventory_categories (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    description varchar(500),
    name varchar(100) not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE inventory_items (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    quantity integer not null,
    reserved_quantity integer not null,
    product_id bigint not null,
    warehouse_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE inventory_transactions (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    date datetime(6) not null,
    notes TEXT,
    quantity integer not null,
    reference varchar(100),
    reference_id bigint,
    reference_type varchar(50),
    type varchar(50) not null,
    destination_warehouse_id bigint,
    product_id bigint not null,
    project_id bigint,
    source_warehouse_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE invoice_items (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    description varchar(255) not null,
    gst_rate decimal(5,2),
    quantity integer not null,
    total_price decimal(15,2) not null,
    unit_price decimal(15,2) not null,
    invoice_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE invoices (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    date date not null,
    due_date date,
    gst_amount decimal(15,2),
    invoice_number varchar(50) not null,
    notes TEXT,
    status varchar(50) not null,
    sub_total decimal(15,2),
    terms TEXT,
    total_amount decimal(15,2),
    customer_id bigint not null,
    project_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE lead_activities (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    action varchar(100) not null,
    description TEXT,
    lead_id bigint not null,
    performed_by bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE lead_assignments (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    assigned_date datetime(6) not null,
    assigned_role varchar(50),
    remarks TEXT,
    assigned_by_id bigint,
    assigned_to_id bigint not null,
    lead_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE lead_communications (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    attachment_url varchar(500),
    communication_date date not null,
    communication_time time(6),
    communication_type varchar(50) not null,
    detailed_notes TEXT,
    direction varchar(20),
    summary varchar(255),
    lead_id bigint not null,
    performed_by_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE lead_documents (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    category varchar(100),
    description TEXT,
    document_type varchar(100),
    document_version varchar(50),
    file_name varchar(200) not null,
    file_url varchar(500),
    lead_id bigint not null,
    uploaded_by bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE lead_followups (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    customer_response TEXT,
    followup_date date not null,
    followup_time time(6),
    method varchar(50),
    next_followup_date date,
    next_followup_time time(6),
    notes TEXT,
    outcome varchar(100),
    priority varchar(20),
    reminder_enabled bit,
    status varchar(50),
    lead_id bigint not null,
    performed_by_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE lead_labels (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    label_color varchar(50),
    label_name varchar(100) not null,
    lead_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE lead_negotiations (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    negotiated_amount decimal(15,2),
    negotiation_date datetime(6),
    quoted_amount decimal(15,2),
    remarks TEXT,
    status varchar(50),
    lead_id bigint not null,
    negotiated_by bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE lead_notes (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    content TEXT not null,
    author_id bigint,
    lead_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE lead_reminders (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    completed_at datetime(6),
    description varchar(200),
    is_completed bit not null,
    priority varchar(20),
    reminder_time datetime(6) not null,
    status varchar(50),
    task_type varchar(50),
    title varchar(200),
    assigned_to bigint,
    lead_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE lead_status_history (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    changed_at datetime(6) not null,
    new_status varchar(50) not null,
    old_status varchar(50),
    remarks TEXT,
    changed_by_id bigint,
    lead_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE leads (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    address TEXT,
    alternate_mobile varchar(50),
    approval_status varchar(50),
    area_sqft decimal(10,2),
    assigned_date datetime(6),
    branch varchar(100),
    can_reopen bit,
    city varchar(100),
    company_name varchar(150),
    competitor varchar(150),
    contact_person varchar(150),
    conversion_notes TEXT,
    converted_date datetime(6),
    current_construction_stage varchar(100),
    customer_feedback TEXT,
    customer_requirements TEXT,
    department varchar(100),
    district varchar(100),
    email varchar(100),
    estimated_budget decimal(15,2),
    estimated_duration varchar(100),
    expected_end_date date,
    expected_project_value decimal(15,2),
    expected_start_date date,
    expected_work_area decimal(10,2),
    floor_count integer,
    follow_up_count integer,
    follow_up_notes TEXT,
    follow_up_outcome varchar(100),
    google_map_location TEXT,
    gst_number varchar(50),
    is_converted bit not null,
    landmark varchar(150),
    last_contact_at datetime(6),
    last_follow_up datetime(6),
    lead_number varchar(50),
    lead_source varchar(50),
    lead_temperature varchar(20),
    lead_type varchar(50),
    lost_reason TEXT,
    maximum_budget decimal(15,2),
    measurement_completed bit,
    measurement_required bit,
    minimum_budget decimal(15,2),
    mobile_number varchar(50),
    name varchar(200),
    next_follow_up_date date,
    next_follow_up_time time(6),
    payment_preference varchar(100),
    pincode varchar(20),
    preferred_color_theme varchar(100),
    preferred_completion_date date,
    preferred_design_style varchar(100),
    preferred_material varchar(100),
    priority varchar(20),
    project_description TEXT,
    property_name varchar(150),
    property_type varchar(100),
    quotation_amount decimal(15,2),
    quotation_created bit,
    quotation_date date,
    quotation_number varchar(50),
    quotation_status varchar(50),
    remarks TEXT,
    reminder_enabled bit,
    reminder_type varchar(50),
    req_electrical bit,
    req_false_ceiling bit,
    req_flooring bit,
    req_kitchen bit,
    req_painting bit,
    req_plumbing bit,
    req_tv_unit bit,
    req_wardrobe bit,
    req_wood_finish bit,
    requirement_category varchar(100),
    rooms_required TEXT,
    site_address TEXT,
    site_notes TEXT,
    site_visit_date date,
    site_visit_required bit,
    site_visit_time time(6),
    special_requests TEXT,
    stage varchar(50),
    state varchar(100),
    status varchar(50) not null,
    visit_status varchar(50),
    whatsapp_number varchar(50),
    assigned_by_id bigint,
    assigned_designer_id bigint,
    assigned_engineer_id bigint,
    assigned_executive_id bigint,
    converted_by_id bigint,
    converted_customer_id bigint,
    converted_project_id bigint,
    lead_owner_id bigint,
    project_manager_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE leave_requests (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    approved_by varchar(255),
    end_date date not null,
    reason TEXT,
    start_date date not null,
    status varchar(20) not null,
    type varchar(50) not null,
    employee_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE login_history (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    attempted_email varchar(100),
    ip_address varchar(45),
    login_time datetime(6) not null,
    status varchar(20) not null,
    user_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE measurement_activity_logs (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    action_time datetime(6),
    action_type varchar(100),
    description TEXT,
    performed_by varchar(100),
    role varchar(100),
    measurement_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE measurement_assignments (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    accepted_time datetime(6),
    assigned_date datetime(6),
    completed_time datetime(6),
    remarks TEXT,
    role varchar(50),
    status varchar(50),
    assigned_by_id bigint,
    employee_id bigint not null,
    measurement_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE measurement_ceilings (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    ac_points integer,
    ceiling_type varchar(100),
    false_ceiling_required bit,
    fan_points integer,
    height float(53),
    lighting_points integer,
    material_type varchar(100),
    remarks TEXT,
    measurement_room_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE measurement_checklists (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    completed_at datetime(6),
    completed_by varchar(100),
    is_completed bit,
    item_name varchar(200),
    remarks TEXT,
    sort_order integer,
    measurement_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE measurement_doors (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    door_name varchar(100),
    frame_type varchar(100),
    glass varchar(100),
    hardware_required TEXT,
    height float(53),
    material varchar(100),
    remarks TEXT,
    width float(53),
    measurement_room_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE measurement_drawings (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    description TEXT,
    drawing_type varchar(100),
    file_name varchar(255),
    file_path TEXT,
    file_size bigint,
    file_type varchar(50),
    measurement_id bigint not null,
    uploaded_by_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE measurement_electrical (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    ac_points integer,
    cctv_points integer,
    fan_points integer,
    light_points integer,
    network_points integer,
    power_load varchar(50),
    remarks TEXT,
    socket_points integer,
    switch_points integer,
    tv_points integer,
    measurement_room_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE measurement_floors (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    floor_area float(53),
    floor_type varchar(100),
    remarks TEXT,
    skirting_length float(53),
    tile_type varchar(100),
    measurement_room_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE measurement_furniture (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    finish varchar(100),
    furniture_type varchar(100),
    height float(53),
    length float(53),
    material varchar(100),
    quantity integer,
    remarks TEXT,
    width float(53),
    measurement_room_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE measurement_history (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    change_reason TEXT,
    changed_at datetime(6),
    changed_by varchar(100),
    new_values LONGTEXT,
    previous_values LONGTEXT,
    snapshot_data LONGTEXT,
    version_number integer,
    measurement_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE measurement_items (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    area float(53),
    height float(53),
    item_name varchar(150),
    item_type varchar(50),
    length float(53),
    material varchar(100),
    notes TEXT,
    quantity integer,
    unit varchar(20),
    width float(53),
    measurement_room_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE measurement_material_estimates (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    edge_band float(53),
    electrical_cable float(53),
    false_ceiling float(53),
    flooring float(53),
    granite float(53),
    hardware integer,
    laminates float(53),
    lighting integer,
    marble float(53),
    paint_area float(53),
    plywood_sheets float(53),
    remarks TEXT,
    tile_area float(53),
    wallpaper_area float(53),
    measurement_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE measurement_media (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    category varchar(50),
    description TEXT,
    file_name varchar(255),
    file_path TEXT,
    media_type varchar(50),
    measurement_id bigint,
    measurement_room_id bigint,
    uploaded_by_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE measurement_plumbing (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    drainage bit,
    geyser_point bit,
    kitchen_sink bit,
    remarks TEXT,
    shower bit,
    toilet bit,
    wash_basin bit,
    water_inlet bit,
    water_tank bit,
    measurement_room_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE measurement_rooms (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    beam_count integer,
    ceiling_area float(53),
    ceiling_height float(53),
    column_count integer,
    description TEXT,
    door_area float(53),
    door_count integer,
    false_ceiling_area float(53),
    false_ceiling_required bit,
    floor_area float(53),
    floor_number varchar(20),
    flooring_required bit,
    height float(53),
    kitchen_required bit,
    length float(53),
    loft_required bit,
    notes TEXT,
    paintable_area float(53),
    painting_required bit,
    perimeter float(53),
    room_name varchar(100),
    room_type varchar(50),
    status varchar(50),
    storage_required bit,
    tile_area float(53),
    tv_unit_required bit,
    wall_area float(53),
    wardrobe_required bit,
    width float(53),
    window_area float(53),
    window_count integer,
    woodwork_area float(53),
    measurement_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE measurement_walls (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    electrical_points integer,
    false_wall bit,
    finish_type varchar(100),
    height float(53),
    length float(53),
    paint_required bit,
    remarks TEXT,
    thickness float(53),
    wall_name varchar(50),
    wallpaper_required bit,
    measurement_room_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE measurement_windows (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    blinds_required bit,
    curtain_required bit,
    frame_material varchar(100),
    glass_type varchar(100),
    height float(53),
    remarks TEXT,
    width float(53),
    window_name varchar(100),
    measurement_room_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE measurements (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    approval_date datetime(6),
    approved_at datetime(6),
    completed_at datetime(6),
    construction_stage varchar(100),
    customer_remarks TEXT,
    digital_signature LONGTEXT,
    end_time time(6),
    engineer_signature LONGTEXT,
    internal_notes TEXT,
    is_latest_revision bit,
    location varchar(200),
    map_location TEXT,
    measured_by varchar(100),
    measurement_date date,
    measurement_number varchar(50),
    measurement_type varchar(50),
    priority varchar(20),
    property_type varchar(100),
    rejection_reason TEXT,
    remarks TEXT,
    reviewed_at datetime(6),
    revision_number integer,
    room_count integer,
    site_address TEXT,
    start_time time(6),
    status varchar(50),
    submitted_at datetime(6),
    total_area float(53),
    total_ceiling_area float(53),
    total_door_area float(53),
    total_false_ceiling_area float(53),
    total_floor_area float(53),
    total_floors integer,
    total_paintable_area float(53),
    total_tile_area float(53),
    total_wall_area float(53),
    total_window_area float(53),
    total_woodwork_area float(53),
    verified_by varchar(100),
    approved_by_id bigint,
    assigned_engineer_id bigint,
    customer_id bigint,
    designer_id bigint,
    lead_id bigint,
    parent_measurement_id bigint,
    project_id bigint,
    reviewed_by_id bigint,
    site_visit_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE notification_settings (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    email_enabled bit not null,
    in_app_enabled bit not null,
    sms_enabled bit not null,
    user_id bigint not null,
    whatsapp_enabled bit not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE notifications (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    action_url varchar(500),
    is_read bit not null,
    message TEXT not null,
    recipient_id bigint not null,
    title varchar(200) not null,
    type varchar(50) not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE performance_reviews (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    comments TEXT,
    rating integer not null,
    review_date date not null,
    reviewer_name varchar(100),
    employee_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE permissions (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    name varchar(50) not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE products (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    barcode varchar(100),
    brand varchar(100),
    cost_price decimal(15,2),
    min_stock_level integer,
    name varchar(200) not null,
    price decimal(15,2),
    qr_code varchar(100),
    selling_price decimal(15,2),
    sku varchar(100),
    unit varchar(50),
    category_id bigint,
    supplier_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE project_activity_logs (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    description TEXT not null,
    role varchar(50),
    log_time datetime(6) not null,
    project_id bigint not null,
    user_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE project_change_request_phases (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    action varchar(20) not null,
    change_request_id bigint not null,
    project_phase_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE project_change_requests (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    approval_date datetime(6),
    change_type varchar(50) not null,
    completed_date datetime(6),
    description TEXT,
    reason TEXT,
    rejection_reason TEXT,
    request_date date,
    request_number varchar(50),
    resulting_boq_id bigint,
    resulting_quotation_id bigint,
    status varchar(50) not null,
    approved_by_id bigint,
    customer_id bigint,
    project_id bigint not null,
    requested_by_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE project_customer_approvals (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    approval_date datetime(6),
    approval_type varchar(100),
    digital_signature_base64 TEXT,
    remarks TEXT,
    status varchar(50) not null,
    project_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE project_daily_log_employees (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    hours_worked float(53),
    present bit not null,
    daily_log_id bigint not null,
    employee_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE project_daily_log_materials (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    quantity_used decimal(15,2),
    daily_log_id bigint not null,
    product_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE project_daily_log_media (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    caption varchar(255),
    file_url TEXT,
    media_type varchar(20) not null,
    daily_log_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE project_daily_logs (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    equipment TEXT,
    issues TEXT,
    log_date date not null,
    manpower integer,
    percentage_completed integer,
    remarks TEXT,
    risks TEXT,
    weather varchar(200),
    work_completed TEXT,
    work_pending TEXT,
    project_id bigint not null,
    reported_by_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE project_documents (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    document_type varchar(100),
    document_version integer,
    file_base64 TEXT,
    file_name varchar(200) not null,
    file_url varchar(500),
    remarks TEXT,
    upload_date datetime(6),
    project_id bigint not null,
    uploaded_by_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE project_employees (
    project_id bigint not null,
    user_id bigint not null,
    primary key (project_id, user_id)
) ENGINE=InnoDB;

CREATE TABLE project_issues (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    description TEXT,
    due_date date,
    priority varchar(50) not null,
    resolution TEXT,
    status varchar(50) not null,
    issue_title varchar(255) not null,
    assigned_to_id bigint,
    project_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE project_material_requirements (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    consumed_qty decimal(15,2),
    issued_qty decimal(15,2),
    remarks TEXT,
    required_qty decimal(15,2) not null,
    reserved_qty decimal(15,2),
    returned_qty decimal(15,2),
    unit varchar(20),
    phase_id bigint,
    product_id bigint not null,
    project_id bigint not null,
    purchase_order_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE project_payments (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    amount decimal(15,2) not null,
    payment_date date not null,
    payment_method varchar(50),
    remarks TEXT,
    status varchar(50) not null,
    project_id bigint not null,
    received_by_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE project_phases (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    actual_cost decimal(15,2),
    boq_phase_id bigint,
    budget decimal(15,2),
    completion_percentage integer,
    end_date date,
    estimated_cost decimal(15,2),
    name varchar(200) not null,
    remarks TEXT,
    sequence integer not null,
    start_date date,
    status varchar(50),
    project_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE project_quality_checks (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    checklist_category varchar(100),
    inspection_date date,
    item_checked varchar(255),
    remarks TEXT,
    status varchar(50) not null,
    inspector_id bigint,
    project_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE project_risks (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    description TEXT,
    impact varchar(50) not null,
    mitigation_plan TEXT,
    probability varchar(50) not null,
    risk_level varchar(50) not null,
    status varchar(50) not null,
    title varchar(255) not null,
    project_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE project_room_items (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    boq_item_id bigint,
    description TEXT,
    item_name varchar(200) not null,
    item_type varchar(50) not null,
    quantity decimal(15,2),
    remarks TEXT,
    status varchar(50),
    unit varchar(20),
    room_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE project_rooms (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    completion_percentage integer,
    floor_name varchar(100),
    remarks TEXT,
    room_name varchar(150) not null,
    room_type varchar(100),
    phase_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE project_stages (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    completion_date date,
    completion_percentage integer,
    due_date date,
    name varchar(200) not null,
    remarks TEXT,
    status varchar(50) not null,
    owner_id bigint,
    project_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE project_team (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    assigned_date datetime(6),
    remarks TEXT,
    role varchar(50) not null,
    status varchar(50) not null,
    assigned_by_id bigint,
    employee_id bigint not null,
    project_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE projects (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    actual_completion_date date,
    actual_cost decimal(15,2),
    budget decimal(15,2),
    completion_certificate_base64 TEXT,
    customer_notes TEXT,
    expected_completion_date date,
    estimated_cost decimal(15,2),
    internal_notes TEXT,
    priority varchar(50),
    progress integer not null,
    project_category varchar(100),
    project_code varchar(50),
    project_description TEXT,
    project_name varchar(255) not null,
    project_notes TEXT,
    project_type varchar(100),
    property_address TEXT,
    spent_amount decimal(15,2),
    start_date date,
    status varchar(50) not null,
    warranty_end_date date,
    boq_id bigint,
    customer_id bigint,
    designer_id bigint,
    lead_id bigint,
    measurement_id bigint,
    project_manager_id bigint,
    quotation_id bigint,
    sales_executive_id bigint,
    site_engineer_id bigint,
    site_visit_id bigint,
    supervisor_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE purchase_bills (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    bill_number varchar(50) not null,
    date date not null,
    due_date date,
    status varchar(50) not null,
    total_amount decimal(15,2) not null,
    purchase_order_id bigint not null,
    supplier_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE purchase_order_items (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    quantity integer not null,
    received_quantity integer,
    total_price decimal(15,2) not null,
    unit_price decimal(15,2) not null,
    product_id bigint not null,
    purchase_order_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE purchase_orders (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    date date not null,
    expected_delivery_date date,
    notes TEXT,
    po_number varchar(50) not null,
    status varchar(50) not null,
    total_amount decimal(15,2),
    supplier_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE purchase_payments (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    amount decimal(15,2) not null,
    payment_date date not null,
    payment_method varchar(50),
    reference_number varchar(100),
    purchase_bill_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE quotation_activities (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    action varchar(100) not null,
    description TEXT,
    performed_by bigint,
    quotation_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE quotation_additional_charges (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    amount decimal(15,2),
    charge_type varchar(100) not null,
    description TEXT,
    quotation_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE quotation_approvals (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    approval_date datetime(6),
    approval_level varchar(50) not null,
    comments TEXT,
    status varchar(50) not null,
    quotation_id bigint not null,
    reviewer_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE quotation_attachments (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    document_type varchar(50),
    document_version integer,
    file_name varchar(200) not null,
    file_url varchar(500) not null,
    quotation_id bigint not null,
    uploaded_by_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE quotation_discounts (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    amount decimal(15,2),
    approved_by varchar(255),
    coupon_code varchar(50),
    description TEXT,
    discount_type varchar(50) not null,
    percentage decimal(5,2),
    quotation_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE quotation_items (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    boq_item_id bigint,
    category varchar(50),
    cost_amount decimal(15,2),
    description TEXT,
    discount_percentage decimal(5,2),
    gst_percentage decimal(5,2),
    item_code varchar(50),
    item_name varchar(255) not null,
    quantity decimal(15,2) not null,
    rate decimal(15,2) not null,
    remarks TEXT,
    status varchar(20),
    tax_amount decimal(15,2),
    total_amount decimal(15,2) not null,
    unit varchar(20),
    quotation_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE quotation_labour (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    amount decimal(15,2),
    hours decimal(10,2),
    labour_category varchar(100),
    rate decimal(15,2),
    remarks TEXT,
    work_type varchar(100) not null,
    assigned_contractor_id bigint,
    quotation_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE quotation_negotiations (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    changed_items TEXT,
    customer_remarks TEXT,
    new_price decimal(15,2),
    old_price decimal(15,2),
    revision_number integer not null,
    sales_remarks TEXT,
    manager_approval_id bigint,
    quotation_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE quotation_taxes (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    amount decimal(15,2),
    is_inclusive bit,
    percentage decimal(5,2),
    tax_type varchar(50) not null,
    quotation_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE quotation_terms (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    content TEXT not null,
    is_standard bit,
    term_category varchar(100) not null,
    quotation_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE quotations (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    approved_date datetime(6),
    budget_cap decimal(15,2),
    currency varchar(10),
    customer_signature_base64 TEXT,
    discount decimal(15,2),
    expiry_date date,
    grand_total decimal(15,2),
    gst decimal(15,2),
    internal_approval_status varchar(50),
    is_latest_version bit,
    parent_quotation_id bigint,
    priority varchar(20),
    quotation_date date,
    quotation_mode varchar(20),
    quotation_number varchar(50) not null,
    revision_number integer,
    status varchar(50) not null,
    terms_and_conditions TEXT,
    approved_by_id bigint,
    boq_id bigint,
    customer_id bigint,
    lead_id bigint,
    measurement_id bigint,
    prepared_by_id bigint,
    project_id bigint,
    reviewed_by_id bigint,
    site_visit_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE refresh_tokens (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    expiry_date datetime(6) not null,
    token varchar(255) not null,
    user_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
    role_id bigint not null,
    permission_id bigint not null,
    primary key (role_id, permission_id)
) ENGINE=InnoDB;

CREATE TABLE roles (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    name varchar(50) not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE salary_records (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    allowances decimal(15,2),
    basic decimal(15,2) not null,
    deductions decimal(15,2),
    month integer not null,
    net_salary decimal(15,2) not null,
    payment_date date,
    status varchar(20) not null,
    year integer not null,
    employee_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE site_measurements (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    area float(53),
    ceiling_height float(53),
    doors integer,
    floor_type varchar(100),
    measurement_height float(53),
    measurement_length float(53),
    notes TEXT,
    wall_finish varchar(100),
    measurement_width float(53),
    windows integer,
    site_room_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE site_rooms (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    room_name varchar(100) not null,
    site_visit_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE site_visit_assignments (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    accepted_time datetime(6),
    arrival_time datetime(6),
    assigned_date datetime(6) not null,
    completed_time datetime(6),
    remarks TEXT,
    role varchar(100),
    status varchar(50),
    assigned_by_user_id bigint,
    assigned_user_id bigint not null,
    site_visit_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE site_visit_checklists (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    is_completed bit not null,
    item varchar(255) not null,
    remarks TEXT,
    site_visit_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE site_visit_history (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    action varchar(100) not null,
    action_timestamp datetime(6) not null,
    remarks TEXT,
    performed_by_user_id bigint,
    site_visit_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE site_visit_media (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    category varchar(50),
    description TEXT,
    file_url LONGTEXT,
    file_version varchar(50),
    media_type varchar(50) not null,
    upload_time datetime(6),
    site_visit_id bigint not null,
    uploaded_by_user_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE site_visits (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    accessibility varchar(200),
    actual_end_time datetime(6),
    actual_start_time datetime(6),
    area_sqft float(53),
    budget float(53),
    completion_timeline varchar(100),
    construction_stage varchar(100),
    customer_contact_person varchar(255),
    customer_mobile varchar(20),
    customer_notes TEXT,
    electrical_issues TEXT,
    expected_duration varchar(50),
    floor_condition TEXT,
    furniture_condition TEXT,
    google_maps_link varchar(500),
    internal_notes TEXT,
    latitude float(53),
    location_address TEXT,
    longitude float(53),
    map_location TEXT,
    next_action_notes TEXT,
    next_visit_date date,
    next_visit_purpose varchar(100),
    next_visit_required bit,
    next_visit_time datetime(6),
    outcome varchar(100),
    painting_condition TEXT,
    parking_availability bit,
    plumbing_issues TEXT,
    power_availability bit,
    preferred_colors varchar(200),
    preferred_materials varchar(200),
    preferred_style varchar(100),
    priority varchar(50),
    property_type varchar(100),
    recommendations TEXT,
    reminder_enabled bit,
    reminder_sent bit,
    safety_concerns TEXT,
    scheduled_date date,
    scheduled_time datetime(6),
    signature_base64 LONGTEXT,
    signature_date datetime(6),
    signature_remarks TEXT,
    signed_by_customer varchar(255),
    site_condition varchar(200),
    special_instructions TEXT,
    status varchar(50),
    structural_issues TEXT,
    total_floors integer,
    visit_notes TEXT,
    visit_number varchar(50),
    visit_type varchar(100),
    water_availability bit,
    customer_id bigint,
    follow_up_from_id bigint,
    lead_id bigint,
    next_visit_assigned_to bigint,
    project_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE suppliers (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    address TEXT,
    contact_person varchar(100),
    email varchar(100),
    name varchar(150) not null,
    performance_rating integer,
    phone varchar(50),
    tax_id varchar(100),
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE tags (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    color varchar(20),
    name varchar(50) not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE task_assignments (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    assigned_date datetime(6),
    expected_completion datetime(6),
    remarks TEXT,
    status varchar(50) not null,
    assigned_by_id bigint,
    employee_id bigint,
    task_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE task_attachments (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    file_name varchar(200) not null,
    file_url varchar(500) not null,
    version_number integer,
    task_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE task_checklist_items (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    content varchar(255) not null,
    is_completed bit not null,
    order_index integer,
    checklist_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE task_checklists (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    name varchar(255) not null,
    task_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE task_comments (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    content TEXT not null,
    has_attachments bit,
    read_status bit,
    role varchar(50),
    author_id bigint not null,
    task_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE task_dependencies (
    task_id bigint not null,
    dependency_id bigint not null,
    primary key (task_id, dependency_id)
) ENGINE=InnoDB;

CREATE TABLE task_time_logs (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    break_time_minutes integer,
    completed_at datetime(6),
    overtime_minutes integer,
    paused_at datetime(6),
    resumed_at datetime(6),
    started_at datetime(6),
    working_time_minutes integer,
    employee_id bigint not null,
    task_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE tasks (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    actual_hours float(53),
    description TEXT,
    due_date date,
    estimated_hours float(53),
    generated_from_boq_item_id bigint,
    is_recurring bit,
    is_template bit,
    order_index integer,
    priority varchar(20) not null,
    recurring_pattern varchar(50),
    required_skills varchar(255),
    start_date date,
    status varchar(50) not null,
    task_name varchar(255) not null,
    assigned_employee_id bigint,
    contractor_id bigint,
    parent_task_id bigint,
    phase_id bigint,
    project_id bigint not null,
    room_id bigint,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE user_roles (
    user_id bigint not null,
    role_id bigint not null,
    primary key (user_id, role_id)
) ENGINE=InnoDB;

CREATE TABLE users (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    account_non_locked bit not null,
    email varchar(100) not null,
    email_verified bit not null,
    failed_attempts integer not null,
    lock_time datetime(6),
    name varchar(100) not null,
    password varchar(255) not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE verification_tokens (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    expiry_date datetime(6) not null,
    purpose varchar(255) not null,
    token varchar(255) not null,
    user_id bigint not null,
    primary key (id)
) ENGINE=InnoDB;

CREATE TABLE warehouses (
    id bigint not null auto_increment,
    created_at datetime(6),
    created_by varchar(255),
    deleted_at datetime(6),
    deleted_by varchar(255),
    is_deleted bit not null,
    updated_at datetime(6),
    updated_by varchar(255),
    version bigint,
    location varchar(255),
    manager_name varchar(100),
    name varchar(100) not null,
    primary key (id)
) ENGINE=InnoDB;

-- Unique constraints
ALTER TABLE boqs ADD CONSTRAINT UK_lf89bsvu28yt369w0detbbqo2 UNIQUE (boq_number);
ALTER TABLE credit_debit_notes ADD CONSTRAINT UK_cqlt6qsmqhsskgr5t47u434d3 UNIQUE (note_number);
ALTER TABLE customer_payments ADD CONSTRAINT UK_skb1j89poj251l1avhi50648o UNIQUE (payment_number);
ALTER TABLE customers ADD CONSTRAINT UK_iqv746oh5t5is1vr4p2nl79r6 UNIQUE (customer_code);
ALTER TABLE departments ADD CONSTRAINT UK_j6cwks7xecs5jov19ro8ge3qk UNIQUE (name);
ALTER TABLE employees ADD CONSTRAINT UK_j9xgmd0ya5jmus09o0b8pqrpb UNIQUE (email);
ALTER TABLE employees ADD CONSTRAINT UK_etqhw9qqnad1kyjq3ks1glw8x UNIQUE (employee_code);
ALTER TABLE goods_receipt_notes ADD CONSTRAINT UK_gtb27cvttpl1rfvglfosy5301 UNIQUE (grn_number);
ALTER TABLE inventory_items ADD CONSTRAINT UKbmfh1xfvgrfs3x0pc8g6xpkdj UNIQUE (product_id, warehouse_id);
ALTER TABLE invoices ADD CONSTRAINT UK_l1x55mfsay7co0r3m9ynvipd5 UNIQUE (invoice_number);
ALTER TABLE leads ADD CONSTRAINT UK_p2byvjcuk0iv1wjdxx6o1sksc UNIQUE (lead_number);
ALTER TABLE measurements ADD CONSTRAINT UK_fjxjwxtw9dmen9cm8fbtaebvp UNIQUE (measurement_number);
ALTER TABLE notification_settings ADD CONSTRAINT UK_m9ggfvif86mvq5382j88cequn UNIQUE (user_id);
ALTER TABLE permissions ADD CONSTRAINT UK_pnvtwliis6p05pn6i3ndjrqt2 UNIQUE (name);
ALTER TABLE products ADD CONSTRAINT UK_fhmd06dsmj6k0n90swsh8ie9g UNIQUE (sku);
ALTER TABLE project_change_requests ADD CONSTRAINT UK_ao4pn788jw0vylmmac76bo9qn UNIQUE (request_number);
ALTER TABLE projects ADD CONSTRAINT UK_1batb7mq0elcfcs3d6maqo6sg UNIQUE (project_code);
ALTER TABLE projects ADD CONSTRAINT UK_lquot8edjseeafriee5pbr8ac UNIQUE (boq_id);
ALTER TABLE projects ADD CONSTRAINT UK_iirfg0rcdmx24uph95shgu2c7 UNIQUE (measurement_id);
ALTER TABLE projects ADD CONSTRAINT UK_11kthdgwe5hucs4ple3657206 UNIQUE (quotation_id);
ALTER TABLE projects ADD CONSTRAINT UK_1w8mllsy4uwpksjnr13xic0ic UNIQUE (site_visit_id);
ALTER TABLE purchase_bills ADD CONSTRAINT UK_63gvhkj3hdsti1201fd2ex7mg UNIQUE (bill_number);
ALTER TABLE purchase_orders ADD CONSTRAINT UK_pbiykvcpyg0jslne4gviyeuc2 UNIQUE (po_number);
ALTER TABLE quotations ADD CONSTRAINT UK_9kbnjdxcf5d7qxwy80ple68bh UNIQUE (quotation_number);
ALTER TABLE refresh_tokens ADD CONSTRAINT UK_ghpmfn23vmxfu3spu3lfg4r2d UNIQUE (token);
ALTER TABLE refresh_tokens ADD CONSTRAINT UK_7tdcd6ab5wsgoudnvj7xf1b7l UNIQUE (user_id);
ALTER TABLE roles ADD CONSTRAINT UK_ofx66keruapi6vyqpv6f2or37 UNIQUE (name);
ALTER TABLE site_visits ADD CONSTRAINT UK_5agwlq3xchkuhbyewajr6ic7f UNIQUE (visit_number);
ALTER TABLE tags ADD CONSTRAINT UK_t48xdq560gs3gap9g7jg36kgc UNIQUE (name);
ALTER TABLE users ADD CONSTRAINT UK_6dotkott2kjsp8vw4d0m25fb7 UNIQUE (email);
ALTER TABLE verification_tokens ADD CONSTRAINT UK_6q9nsb665s9f8qajm3j07kd1e UNIQUE (token);

-- Foreign keys
ALTER TABLE attendance ADD CONSTRAINT FKb48lmkou5j4rvde9sr88bqgjw FOREIGN KEY (employee_id) REFERENCES employees (id);
ALTER TABLE boq_activity_logs ADD CONSTRAINT FK1n4a7lv2r2tsq8gsh2qq9rstw FOREIGN KEY (boq_id) REFERENCES boqs (id);
ALTER TABLE boq_change_logs ADD CONSTRAINT FKsexn6w9yto1ecxixekbbkt41f FOREIGN KEY (boq_id) REFERENCES boqs (id);
ALTER TABLE boq_change_logs ADD CONSTRAINT FK88awxu2n6s7mjl19ee2yhtost FOREIGN KEY (boq_item_id) REFERENCES boq_items (id);
ALTER TABLE boq_change_logs ADD CONSTRAINT FKacl74552rga23vy6trou06ltb FOREIGN KEY (boq_phase_id) REFERENCES boq_phases (id);
ALTER TABLE boq_change_logs ADD CONSTRAINT FK88a9d0tne5mpflwm89ajwi7c FOREIGN KEY (modified_by_id) REFERENCES users (id);
ALTER TABLE boq_item_labours ADD CONSTRAINT FKk6c2ttbtxpob3230ryqdk0g9s FOREIGN KEY (item_id) REFERENCES boq_items (id);
ALTER TABLE boq_item_materials ADD CONSTRAINT FKgde139ueapfcskcnb667gkxhr FOREIGN KEY (item_id) REFERENCES boq_items (id);
ALTER TABLE boq_item_materials ADD CONSTRAINT FKq4py9l2eeeh2lugjkj2hw7kq1 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE boq_items ADD CONSTRAINT FK92r52vgo07hmb4pscsgknuo9m FOREIGN KEY (boq_id) REFERENCES boqs (id);
ALTER TABLE boq_items ADD CONSTRAINT FKpx95n6q11beodgecdgypo45we FOREIGN KEY (phase_id) REFERENCES boq_phases (id);
ALTER TABLE boq_phases ADD CONSTRAINT FK9iby59arnkcwtjgxi4ypudcck FOREIGN KEY (boq_id) REFERENCES boqs (id);
ALTER TABLE boqs ADD CONSTRAINT FKqwdhorvrex6xila05jhvupnkq FOREIGN KEY (approved_by_id) REFERENCES users (id);
ALTER TABLE boqs ADD CONSTRAINT FKrwockitjyuoxts3iv27x4wnpb FOREIGN KEY (created_by_id) REFERENCES users (id);
ALTER TABLE boqs ADD CONSTRAINT FK3s3aa7ir3gujcrwp807d91d2x FOREIGN KEY (customer_id) REFERENCES customers (id);
ALTER TABLE boqs ADD CONSTRAINT FK1jbww4h5uc4kekkfyqtqidgw3 FOREIGN KEY (measurement_id) REFERENCES measurements (id);
ALTER TABLE boqs ADD CONSTRAINT FK4e73hhlm7di9gsmk6agqsmq7b FOREIGN KEY (project_id) REFERENCES projects (id);
ALTER TABLE boqs ADD CONSTRAINT FKsralo1gh66wkv2j602j75t10y FOREIGN KEY (quotation_id) REFERENCES quotations (id);
ALTER TABLE contact_persons ADD CONSTRAINT FKs0bpvrcp5sg0xuiatkx26vgsf FOREIGN KEY (customer_id) REFERENCES customers (id);
ALTER TABLE contractor_attendance ADD CONSTRAINT FK2rkurmossh6096d64kji55e1u FOREIGN KEY (contractor_id) REFERENCES contractors (id);
ALTER TABLE contractor_documents ADD CONSTRAINT FKtfeqju6319mapw0cqe65fu6xm FOREIGN KEY (contractor_id) REFERENCES contractors (id);
ALTER TABLE contractor_payments ADD CONSTRAINT FK8k08671ntmaknt8go3vx72rp FOREIGN KEY (contractor_id) REFERENCES contractors (id);
ALTER TABLE contractor_projects ADD CONSTRAINT FKk1u2ha00qt43vief9562w0oe1 FOREIGN KEY (contractor_id) REFERENCES contractors (id);
ALTER TABLE contractor_projects ADD CONSTRAINT FK9vf8ngei3fm4fw4hwjp1gaagx FOREIGN KEY (project_id) REFERENCES projects (id);
ALTER TABLE credit_debit_notes ADD CONSTRAINT FK9hrq2gxpr34fb7yqeqic6frdw FOREIGN KEY (customer_id) REFERENCES customers (id);
ALTER TABLE credit_debit_notes ADD CONSTRAINT FK6jpf74d38auu2ttlq5ipblv2p FOREIGN KEY (invoice_id) REFERENCES invoices (id);
ALTER TABLE customer_activities ADD CONSTRAINT FKew2dfoxed5sjj70ykguef4i50 FOREIGN KEY (customer_id) REFERENCES customers (id);
ALTER TABLE customer_activities ADD CONSTRAINT FKlv1cos9bw7p8ch58qjq0e3faa FOREIGN KEY (performed_by_id) REFERENCES users (id);
ALTER TABLE customer_addresses ADD CONSTRAINT FKrvr6wl9gll7u98cda18smugp4 FOREIGN KEY (customer_id) REFERENCES customers (id);
ALTER TABLE customer_documents ADD CONSTRAINT FKp8yxbfjsubcrp9pur4ejb9gtv FOREIGN KEY (customer_id) REFERENCES customers (id);
ALTER TABLE customer_documents ADD CONSTRAINT FK23q5fv12wj01l1spltwkhc807 FOREIGN KEY (uploaded_by_id) REFERENCES users (id);
ALTER TABLE customer_followups ADD CONSTRAINT FK2n2k9pnxcbrxikt4r5k0usu28 FOREIGN KEY (assigned_employee_id) REFERENCES users (id);
ALTER TABLE customer_followups ADD CONSTRAINT FK9h5s29aleuo6uht0dthsbtj8j FOREIGN KEY (created_by_user_id) REFERENCES users (id);
ALTER TABLE customer_followups ADD CONSTRAINT FK2apa7y0bebtbv8cf6idgb1hu3 FOREIGN KEY (customer_id) REFERENCES customers (id);
ALTER TABLE customer_notes ADD CONSTRAINT FKhsenh32dqd1x6qb55ydrvppla FOREIGN KEY (author_id) REFERENCES users (id);
ALTER TABLE customer_notes ADD CONSTRAINT FKmlqmw0fgfmurvcmhkeqtdq7qs FOREIGN KEY (customer_id) REFERENCES customers (id);
ALTER TABLE customer_payments ADD CONSTRAINT FKxc521vx929xnd26fu3dr6scf FOREIGN KEY (customer_id) REFERENCES customers (id);
ALTER TABLE customer_payments ADD CONSTRAINT FKjj5wosb8d7fiv338a1kgp8hve FOREIGN KEY (invoice_id) REFERENCES invoices (id);
ALTER TABLE customer_tags ADD CONSTRAINT FKn6n1iennaqbyvvfqq4ixl29nx FOREIGN KEY (tag_id) REFERENCES tags (id);
ALTER TABLE customer_tags ADD CONSTRAINT FK5xsoqn8hsr5gp8h8pcvu6iosr FOREIGN KEY (customer_id) REFERENCES customers (id);
ALTER TABLE customers ADD CONSTRAINT FKtiwb5y9gex8u37jtmysyr3x9y FOREIGN KEY (assigned_employee_id) REFERENCES users (id);
ALTER TABLE employee_documents ADD CONSTRAINT FK28g0aba9xtbkf6bp9pnvtcw5e FOREIGN KEY (employee_id) REFERENCES employees (id);
ALTER TABLE employees ADD CONSTRAINT FKgy4qe3dnqrm3ktd76sxp7n4c2 FOREIGN KEY (department_id) REFERENCES departments (id);
ALTER TABLE goods_receipt_note_items ADD CONSTRAINT FKefoby6kxg5tk3m80sfka3oipn FOREIGN KEY (grn_id) REFERENCES goods_receipt_notes (id);
ALTER TABLE goods_receipt_note_items ADD CONSTRAINT FK9wnk3olremxp38dr4tpoos8c3 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE goods_receipt_notes ADD CONSTRAINT FKs07ckkj45k30l9kc5lt7vdfjc FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id);
ALTER TABLE goods_receipt_notes ADD CONSTRAINT FK81w8464n2pan6laey31u48qf5 FOREIGN KEY (warehouse_id) REFERENCES warehouses (id);
ALTER TABLE inventory_items ADD CONSTRAINT FK9qhblf3mc4r22jajlv4w6sstt FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE inventory_items ADD CONSTRAINT FKqq1baol3lk2v7ka2ob578l31h FOREIGN KEY (warehouse_id) REFERENCES warehouses (id);
ALTER TABLE inventory_transactions ADD CONSTRAINT FKs39plv4of82dhb2d7568djj1s FOREIGN KEY (destination_warehouse_id) REFERENCES warehouses (id);
ALTER TABLE inventory_transactions ADD CONSTRAINT FKrm9aaxuvvmp9ehvxwe936ar04 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE inventory_transactions ADD CONSTRAINT FKqw4su62uqdrripaabe0emw6km FOREIGN KEY (project_id) REFERENCES projects (id);
ALTER TABLE inventory_transactions ADD CONSTRAINT FK3i9vxnt0ke4iau5xnud5n8lum FOREIGN KEY (source_warehouse_id) REFERENCES warehouses (id);
ALTER TABLE invoice_items ADD CONSTRAINT FK46ae0lhu1oqs7cv91fn6y9n7w FOREIGN KEY (invoice_id) REFERENCES invoices (id);
ALTER TABLE invoices ADD CONSTRAINT FKq2w4hmh6l9othnp6cepp0cfe2 FOREIGN KEY (customer_id) REFERENCES customers (id);
ALTER TABLE invoices ADD CONSTRAINT FK9sxshrq9kflhuqjlccvs3lr0t FOREIGN KEY (project_id) REFERENCES projects (id);
ALTER TABLE lead_activities ADD CONSTRAINT FKle7c8q5nrqmbyt6ewdijgoqqw FOREIGN KEY (lead_id) REFERENCES leads (id);
ALTER TABLE lead_activities ADD CONSTRAINT FK3c3m85pmthxpmbegav2kkmbo6 FOREIGN KEY (performed_by) REFERENCES users (id);
ALTER TABLE lead_assignments ADD CONSTRAINT FK69aaqvujnlt8as54e5ysykyxm FOREIGN KEY (assigned_by_id) REFERENCES users (id);
ALTER TABLE lead_assignments ADD CONSTRAINT FKf4ahjq6fuisodv8eqx67ifg7l FOREIGN KEY (assigned_to_id) REFERENCES users (id);
ALTER TABLE lead_assignments ADD CONSTRAINT FK31y9wc1fqvmuekybhwekcejcy FOREIGN KEY (lead_id) REFERENCES leads (id);
ALTER TABLE lead_communications ADD CONSTRAINT FKq034s4o4yhrw2u6hs9fwubgbl FOREIGN KEY (lead_id) REFERENCES leads (id);
ALTER TABLE lead_communications ADD CONSTRAINT FKt0lqd2nis50bdaxmtv9gkpavg FOREIGN KEY (performed_by_id) REFERENCES users (id);
ALTER TABLE lead_documents ADD CONSTRAINT FKqvh8jdndi3xdw3ktrml6b7i70 FOREIGN KEY (lead_id) REFERENCES leads (id);
ALTER TABLE lead_documents ADD CONSTRAINT FKin3pe4obog2md6hytpwagtgok FOREIGN KEY (uploaded_by) REFERENCES users (id);
ALTER TABLE lead_followups ADD CONSTRAINT FKdbr9iadauxlagves4oqy13y12 FOREIGN KEY (lead_id) REFERENCES leads (id);
ALTER TABLE lead_followups ADD CONSTRAINT FKp9xhyvbvues9pbte1rgelees0 FOREIGN KEY (performed_by_id) REFERENCES users (id);
ALTER TABLE lead_labels ADD CONSTRAINT FKt4t6jgotxyblfklg5uv79nosu FOREIGN KEY (lead_id) REFERENCES leads (id);
ALTER TABLE lead_negotiations ADD CONSTRAINT FKdonlwkp6codv3tkanfcb012ep FOREIGN KEY (lead_id) REFERENCES leads (id);
ALTER TABLE lead_negotiations ADD CONSTRAINT FKex8q807h690jna60wokwqmlmg FOREIGN KEY (negotiated_by) REFERENCES users (id);
ALTER TABLE lead_notes ADD CONSTRAINT FK6vjshrioiyrvxdd6ck3mxguh0 FOREIGN KEY (author_id) REFERENCES users (id);
ALTER TABLE lead_notes ADD CONSTRAINT FKpgleeh9alpqu33f2ac651l1ae FOREIGN KEY (lead_id) REFERENCES leads (id);
ALTER TABLE lead_reminders ADD CONSTRAINT FK7v51lrin7m4li6dj2anm8siop FOREIGN KEY (assigned_to) REFERENCES users (id);
ALTER TABLE lead_reminders ADD CONSTRAINT FK2m8b4538guh8a0p4bgcm1k63m FOREIGN KEY (lead_id) REFERENCES leads (id);
ALTER TABLE lead_status_history ADD CONSTRAINT FKieasxxildpfcjojab57yyg8rn FOREIGN KEY (changed_by_id) REFERENCES users (id);
ALTER TABLE lead_status_history ADD CONSTRAINT FK93am88ab4kic7mf01kybn8ycu FOREIGN KEY (lead_id) REFERENCES leads (id);
ALTER TABLE leads ADD CONSTRAINT FKr3b8qovv2mogf9akd0lwhrx1w FOREIGN KEY (assigned_by_id) REFERENCES users (id);
ALTER TABLE leads ADD CONSTRAINT FK2p3nuni1filntdn3irrrd6ped FOREIGN KEY (assigned_designer_id) REFERENCES users (id);
ALTER TABLE leads ADD CONSTRAINT FK8xlqmxbn764or0tbhje25bg5q FOREIGN KEY (assigned_engineer_id) REFERENCES users (id);
ALTER TABLE leads ADD CONSTRAINT FK4b25f5teghrv042yppjr3xnb1 FOREIGN KEY (assigned_executive_id) REFERENCES users (id);
ALTER TABLE leads ADD CONSTRAINT FKmhtwql32gewyyaugystyjer3n FOREIGN KEY (converted_by_id) REFERENCES users (id);
ALTER TABLE leads ADD CONSTRAINT FK4lja2v20i3645alil8v253xwa FOREIGN KEY (converted_customer_id) REFERENCES customers (id);
ALTER TABLE leads ADD CONSTRAINT FKe21e0vl5g4qf3w8eddd88r7du FOREIGN KEY (converted_project_id) REFERENCES projects (id);
ALTER TABLE leads ADD CONSTRAINT FK2vov5w2bl8ty3nscmyhuit1u2 FOREIGN KEY (lead_owner_id) REFERENCES users (id);
ALTER TABLE leads ADD CONSTRAINT FK2t2y0n7f8nastupbiu00r4j3e FOREIGN KEY (project_manager_id) REFERENCES users (id);
ALTER TABLE leave_requests ADD CONSTRAINT FKrxff2xg1kffbjfh5maxwoqyhw FOREIGN KEY (employee_id) REFERENCES employees (id);
ALTER TABLE login_history ADD CONSTRAINT FK20v0mimmdegh2afs39uixlxpm FOREIGN KEY (user_id) REFERENCES users (id);
ALTER TABLE measurement_activity_logs ADD CONSTRAINT FK9l7js000kdhu10gsdk2iup9mq FOREIGN KEY (measurement_id) REFERENCES measurements (id);
ALTER TABLE measurement_assignments ADD CONSTRAINT FK5820opidflcam2416f70j87e2 FOREIGN KEY (assigned_by_id) REFERENCES users (id);
ALTER TABLE measurement_assignments ADD CONSTRAINT FKgrhuauv915rap8eocwvw55qlm FOREIGN KEY (employee_id) REFERENCES users (id);
ALTER TABLE measurement_assignments ADD CONSTRAINT FKbacng9eys87pg5wbb9c7x88gv FOREIGN KEY (measurement_id) REFERENCES measurements (id);
ALTER TABLE measurement_ceilings ADD CONSTRAINT FKr63ba00r1oe7j2l122dkm7o6a FOREIGN KEY (measurement_room_id) REFERENCES measurement_rooms (id);
ALTER TABLE measurement_checklists ADD CONSTRAINT FKgv49roxb7ptvucuarv5rbhem5 FOREIGN KEY (measurement_id) REFERENCES measurements (id);
ALTER TABLE measurement_doors ADD CONSTRAINT FKltrt46d687mcwmuoo297g66h1 FOREIGN KEY (measurement_room_id) REFERENCES measurement_rooms (id);
ALTER TABLE measurement_drawings ADD CONSTRAINT FKre5cbe0yh9lagp5evt5o5f03 FOREIGN KEY (measurement_id) REFERENCES measurements (id);
ALTER TABLE measurement_drawings ADD CONSTRAINT FKrnthpha75v5o2vqw5roojfbaj FOREIGN KEY (uploaded_by_id) REFERENCES users (id);
ALTER TABLE measurement_electrical ADD CONSTRAINT FK52eiyypft1fp97wq6leb6yib6 FOREIGN KEY (measurement_room_id) REFERENCES measurement_rooms (id);
ALTER TABLE measurement_floors ADD CONSTRAINT FKklo83jgrglhijgt53rkhk7bks FOREIGN KEY (measurement_room_id) REFERENCES measurement_rooms (id);
ALTER TABLE measurement_furniture ADD CONSTRAINT FKlcoljstrp4mk8bgyss3ic5kuh FOREIGN KEY (measurement_room_id) REFERENCES measurement_rooms (id);
ALTER TABLE measurement_history ADD CONSTRAINT FKia7fi43bao826jfmtq191k33a FOREIGN KEY (measurement_id) REFERENCES measurements (id);
ALTER TABLE measurement_items ADD CONSTRAINT FKgyk9dtc9sfn0i84jntr7qvsu5 FOREIGN KEY (measurement_room_id) REFERENCES measurement_rooms (id);
ALTER TABLE measurement_material_estimates ADD CONSTRAINT FKbk3ym35uj7x70a445fj023weh FOREIGN KEY (measurement_id) REFERENCES measurements (id);
ALTER TABLE measurement_media ADD CONSTRAINT FKgt7a687pt98xsqis8qi3pjn8h FOREIGN KEY (measurement_id) REFERENCES measurements (id);
ALTER TABLE measurement_media ADD CONSTRAINT FK1ujuy2fa8x8cdf4evsqfs4ali FOREIGN KEY (measurement_room_id) REFERENCES measurement_rooms (id);
ALTER TABLE measurement_media ADD CONSTRAINT FKn3ddicsay9agthyarfbbbp12q FOREIGN KEY (uploaded_by_id) REFERENCES users (id);
ALTER TABLE measurement_plumbing ADD CONSTRAINT FKorsqgomwdww5snaf2ihs1bmdj FOREIGN KEY (measurement_room_id) REFERENCES measurement_rooms (id);
ALTER TABLE measurement_rooms ADD CONSTRAINT FK5mlfkjl8nx6yqsdfj0iimfs1e FOREIGN KEY (measurement_id) REFERENCES measurements (id);
ALTER TABLE measurement_walls ADD CONSTRAINT FKd5jyfiikp0d4a97ig3d53kgc5 FOREIGN KEY (measurement_room_id) REFERENCES measurement_rooms (id);
ALTER TABLE measurement_windows ADD CONSTRAINT FKhr5g1bkpcrt2fx8813mjj24sj FOREIGN KEY (measurement_room_id) REFERENCES measurement_rooms (id);
ALTER TABLE measurements ADD CONSTRAINT FKkvpe4vpvunnvsetqjxsbiih4x FOREIGN KEY (approved_by_id) REFERENCES users (id);
ALTER TABLE measurements ADD CONSTRAINT FKkjo4ynu0qwmxbmoluoxl1trkq FOREIGN KEY (assigned_engineer_id) REFERENCES users (id);
ALTER TABLE measurements ADD CONSTRAINT FKj9x38gqpne0xw0rqlc97ghuf1 FOREIGN KEY (customer_id) REFERENCES customers (id);
ALTER TABLE measurements ADD CONSTRAINT FKh75m5u9h9e5xwmgc8xplabw1b FOREIGN KEY (designer_id) REFERENCES users (id);
ALTER TABLE measurements ADD CONSTRAINT FKqn0mouh0tmwa6ra2maqh40rvc FOREIGN KEY (lead_id) REFERENCES leads (id);
ALTER TABLE measurements ADD CONSTRAINT FKjnflo9n32263t7ra68og1csbw FOREIGN KEY (parent_measurement_id) REFERENCES measurements (id);
ALTER TABLE measurements ADD CONSTRAINT FKi45o93seoh5rkst31d8h04uuf FOREIGN KEY (project_id) REFERENCES projects (id);
ALTER TABLE measurements ADD CONSTRAINT FKdinjmxm82wsnnub7jv9eamkhy FOREIGN KEY (reviewed_by_id) REFERENCES users (id);
ALTER TABLE measurements ADD CONSTRAINT FKl8byj6u4rawwhj22brynya721 FOREIGN KEY (site_visit_id) REFERENCES site_visits (id);
ALTER TABLE performance_reviews ADD CONSTRAINT FK75f19q3rvitsw5bl5o3k0lirt FOREIGN KEY (employee_id) REFERENCES employees (id);
ALTER TABLE products ADD CONSTRAINT FKi8q0m1h4wn0jembnyty6jad6g FOREIGN KEY (category_id) REFERENCES inventory_categories (id);
ALTER TABLE products ADD CONSTRAINT FK6i174ixi9087gcvvut45em7fd FOREIGN KEY (supplier_id) REFERENCES suppliers (id);
ALTER TABLE project_activity_logs ADD CONSTRAINT FKngvvmcri202n7x6x5xbmrumnk FOREIGN KEY (project_id) REFERENCES projects (id);
ALTER TABLE project_activity_logs ADD CONSTRAINT FKg77v69jv7fdkhk0x8slscuyyn FOREIGN KEY (user_id) REFERENCES users (id);
ALTER TABLE project_change_request_phases ADD CONSTRAINT FK3my6bs73x35pgkbm4uu9lsx73 FOREIGN KEY (change_request_id) REFERENCES project_change_requests (id);
ALTER TABLE project_change_request_phases ADD CONSTRAINT FKiagsok144dyve0dithbti49ua FOREIGN KEY (project_phase_id) REFERENCES project_phases (id);
ALTER TABLE project_change_requests ADD CONSTRAINT FK4iyuyobx7hitt51kworlqvyuk FOREIGN KEY (approved_by_id) REFERENCES users (id);
ALTER TABLE project_change_requests ADD CONSTRAINT FKqoveoydb1m13uxrnk2dhkinlu FOREIGN KEY (customer_id) REFERENCES customers (id);
ALTER TABLE project_change_requests ADD CONSTRAINT FKny0xtvoc420j9q068wrimgqic FOREIGN KEY (project_id) REFERENCES projects (id);
ALTER TABLE project_change_requests ADD CONSTRAINT FKrjv0fxmxqwefinbnwb1j01ig3 FOREIGN KEY (requested_by_id) REFERENCES users (id);
ALTER TABLE project_customer_approvals ADD CONSTRAINT FKkdvpo9glk525o66n8bopf2el5 FOREIGN KEY (project_id) REFERENCES projects (id);
ALTER TABLE project_daily_log_employees ADD CONSTRAINT FKfu251nh2bcx75gws174v5x44l FOREIGN KEY (daily_log_id) REFERENCES project_daily_logs (id);
ALTER TABLE project_daily_log_employees ADD CONSTRAINT FK3v794vwgy93c4tv4kcsf8d41n FOREIGN KEY (employee_id) REFERENCES users (id);
ALTER TABLE project_daily_log_materials ADD CONSTRAINT FKb73g1xa1nkoydq256l7jrfkqj FOREIGN KEY (daily_log_id) REFERENCES project_daily_logs (id);
ALTER TABLE project_daily_log_materials ADD CONSTRAINT FKs9ctq5ycq0mirpv00f18ew4lu FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE project_daily_log_media ADD CONSTRAINT FKt1xe8omokx09rqfumsfo4ssa8 FOREIGN KEY (daily_log_id) REFERENCES project_daily_logs (id);
ALTER TABLE project_daily_logs ADD CONSTRAINT FKk01e8k8b37aayeq46tb2ckyqn FOREIGN KEY (project_id) REFERENCES projects (id);
ALTER TABLE project_daily_logs ADD CONSTRAINT FK5osiywanug6jmk3qg4oclcptq FOREIGN KEY (reported_by_id) REFERENCES users (id);
ALTER TABLE project_documents ADD CONSTRAINT FKfu1nh0td6ql5va3viuej44opf FOREIGN KEY (project_id) REFERENCES projects (id);
ALTER TABLE project_documents ADD CONSTRAINT FKhis4maghou8mlk04wq5j3kvub FOREIGN KEY (uploaded_by_id) REFERENCES users (id);
ALTER TABLE project_employees ADD CONSTRAINT FKrm9lh2ikv9y64wv9r162g7121 FOREIGN KEY (user_id) REFERENCES users (id);
ALTER TABLE project_employees ADD CONSTRAINT FKt9kxewjtx1iqoxwasi3ma5e0t FOREIGN KEY (project_id) REFERENCES projects (id);
ALTER TABLE project_issues ADD CONSTRAINT FKasv2cxqvge3ksdmh3erkfl662 FOREIGN KEY (assigned_to_id) REFERENCES users (id);
ALTER TABLE project_issues ADD CONSTRAINT FKe6ukriepwidh3gtx2sds1g8o3 FOREIGN KEY (project_id) REFERENCES projects (id);
ALTER TABLE project_material_requirements ADD CONSTRAINT FK3u5cf20wvf3o9ewjffmghtucm FOREIGN KEY (phase_id) REFERENCES project_phases (id);
ALTER TABLE project_material_requirements ADD CONSTRAINT FKi2pu8a3lmhvogogw9855i60p8 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE project_material_requirements ADD CONSTRAINT FKj31n0qii3wuyy517mju0g4g6 FOREIGN KEY (project_id) REFERENCES projects (id);
ALTER TABLE project_material_requirements ADD CONSTRAINT FKbp3rnv10p9nwrch2b82r7ar06 FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id);
ALTER TABLE project_payments ADD CONSTRAINT FKf3hw9uhi4o3clhaoia5g02f5o FOREIGN KEY (project_id) REFERENCES projects (id);
ALTER TABLE project_payments ADD CONSTRAINT FKhk9tdocw4fpx7ka0vumg0nw83 FOREIGN KEY (received_by_id) REFERENCES users (id);
ALTER TABLE project_phases ADD CONSTRAINT FKaete97c6firfe27ai9aaddvd FOREIGN KEY (project_id) REFERENCES projects (id);
ALTER TABLE project_quality_checks ADD CONSTRAINT FKr61rpipil2uevyup28s0ewgbm FOREIGN KEY (inspector_id) REFERENCES users (id);
ALTER TABLE project_quality_checks ADD CONSTRAINT FKmvq5kcaocefejfd4sdejgyspf FOREIGN KEY (project_id) REFERENCES projects (id);
ALTER TABLE project_risks ADD CONSTRAINT FK121yxrwrlxyac5ab5gifn1br6 FOREIGN KEY (project_id) REFERENCES projects (id);
ALTER TABLE project_room_items ADD CONSTRAINT FKj7qw0ujj7p2v7ijhtaj0l542w FOREIGN KEY (room_id) REFERENCES project_rooms (id);
ALTER TABLE project_rooms ADD CONSTRAINT FKna540hry8jw9nrqerb9bbsb9i FOREIGN KEY (phase_id) REFERENCES project_phases (id);
ALTER TABLE project_stages ADD CONSTRAINT FKlm67yxhylimq104s2rm8yw7ar FOREIGN KEY (owner_id) REFERENCES users (id);
ALTER TABLE project_stages ADD CONSTRAINT FKns0oaedr03msd6gdeq907n629 FOREIGN KEY (project_id) REFERENCES projects (id);
ALTER TABLE project_team ADD CONSTRAINT FK8xv6ewkt3v99re2fg5qs5yvoi FOREIGN KEY (assigned_by_id) REFERENCES users (id);
ALTER TABLE project_team ADD CONSTRAINT FKootddeef2el7gjohvtgskrs4n FOREIGN KEY (employee_id) REFERENCES users (id);
ALTER TABLE project_team ADD CONSTRAINT FKq0usqcy7xenwfvsdewektjqn7 FOREIGN KEY (project_id) REFERENCES projects (id);
ALTER TABLE projects ADD CONSTRAINT FK6u61y7h2oyq14x93dbw2q2yn5 FOREIGN KEY (boq_id) REFERENCES boqs (id);
ALTER TABLE projects ADD CONSTRAINT FK4rpwuljjwr5rygq9gwx36q8cj FOREIGN KEY (customer_id) REFERENCES customers (id);
ALTER TABLE projects ADD CONSTRAINT FK5nw5tuyxw3ums5huh7r58iahf FOREIGN KEY (designer_id) REFERENCES users (id);
ALTER TABLE projects ADD CONSTRAINT FKbtix0l86q73wgky011177lmba FOREIGN KEY (lead_id) REFERENCES leads (id);
ALTER TABLE projects ADD CONSTRAINT FKdj0lepyohyh68aclyb164xxcm FOREIGN KEY (measurement_id) REFERENCES measurements (id);
ALTER TABLE projects ADD CONSTRAINT FKgdyu73mg454kk9iys9567qft7 FOREIGN KEY (project_manager_id) REFERENCES users (id);
ALTER TABLE projects ADD CONSTRAINT FK196h6p6p4mopw2hf54q4s43kj FOREIGN KEY (quotation_id) REFERENCES quotations (id);
ALTER TABLE projects ADD CONSTRAINT FK75q6l311jms1rot0bs15bdlam FOREIGN KEY (sales_executive_id) REFERENCES users (id);
ALTER TABLE projects ADD CONSTRAINT FKeymeaoxfgkvomcwl4htdemm8p FOREIGN KEY (site_engineer_id) REFERENCES users (id);
ALTER TABLE projects ADD CONSTRAINT FKn639klsccs2dedbx2qcaopgw8 FOREIGN KEY (site_visit_id) REFERENCES site_visits (id);
ALTER TABLE projects ADD CONSTRAINT FKh56cml4v2j3iulnosmcenk7ta FOREIGN KEY (supervisor_id) REFERENCES users (id);
ALTER TABLE purchase_bills ADD CONSTRAINT FKdt3pmdjc1ri9x96sk3ivhmdik FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id);
ALTER TABLE purchase_bills ADD CONSTRAINT FK4tiisp4c86ay1k3xgqhym20w2 FOREIGN KEY (supplier_id) REFERENCES suppliers (id);
ALTER TABLE purchase_order_items ADD CONSTRAINT FKs16e5vrvsp8alu0xp8m3a2ol5 FOREIGN KEY (product_id) REFERENCES products (id);
ALTER TABLE purchase_order_items ADD CONSTRAINT FKo3yj8ocbw2kav38548t22hgh8 FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id);
ALTER TABLE purchase_orders ADD CONSTRAINT FKrpdasmb8y8xs5tiy4369xpinq FOREIGN KEY (supplier_id) REFERENCES suppliers (id);
ALTER TABLE purchase_payments ADD CONSTRAINT FK80l08igfxn3pmjme3kk59gcyk FOREIGN KEY (purchase_bill_id) REFERENCES purchase_bills (id);
ALTER TABLE quotation_activities ADD CONSTRAINT FKp85otv8ac32u7rsx6mtnn7cf FOREIGN KEY (performed_by) REFERENCES users (id);
ALTER TABLE quotation_activities ADD CONSTRAINT FKeqam2f625ya0dvl27x1dxoiq2 FOREIGN KEY (quotation_id) REFERENCES quotations (id);
ALTER TABLE quotation_additional_charges ADD CONSTRAINT FKel42u29fgcxr4agafh5wj5alr FOREIGN KEY (quotation_id) REFERENCES quotations (id);
ALTER TABLE quotation_approvals ADD CONSTRAINT FKkr27vpynr1t0voalvr56em5sg FOREIGN KEY (quotation_id) REFERENCES quotations (id);
ALTER TABLE quotation_approvals ADD CONSTRAINT FKh8lpa8hs8vhksi527161sfylt FOREIGN KEY (reviewer_id) REFERENCES users (id);
ALTER TABLE quotation_attachments ADD CONSTRAINT FK1y34uc6oa6puou8txho8w0yuy FOREIGN KEY (quotation_id) REFERENCES quotations (id);
ALTER TABLE quotation_attachments ADD CONSTRAINT FK9g0f3uvo0hb399uwp5fce9j2c FOREIGN KEY (uploaded_by_id) REFERENCES users (id);
ALTER TABLE quotation_discounts ADD CONSTRAINT FK2y150vurix0khei9f5jyef11m FOREIGN KEY (quotation_id) REFERENCES quotations (id);
ALTER TABLE quotation_items ADD CONSTRAINT FK7y587hckcncga8qtka1i06cbp FOREIGN KEY (quotation_id) REFERENCES quotations (id);
ALTER TABLE quotation_labour ADD CONSTRAINT FK413ee09spqk6jt91vrx22hitc FOREIGN KEY (assigned_contractor_id) REFERENCES contractors (id);
ALTER TABLE quotation_labour ADD CONSTRAINT FK24onx8k3v429ynqegefvwdksm FOREIGN KEY (quotation_id) REFERENCES quotations (id);
ALTER TABLE quotation_negotiations ADD CONSTRAINT FKh3scxlrauhw6e8xv8kpm427cy FOREIGN KEY (manager_approval_id) REFERENCES users (id);
ALTER TABLE quotation_negotiations ADD CONSTRAINT FK7290qsxwx0pycedy58wo23nxs FOREIGN KEY (quotation_id) REFERENCES quotations (id);
ALTER TABLE quotation_taxes ADD CONSTRAINT FKpdttcpyii7u9veicefdudxga7 FOREIGN KEY (quotation_id) REFERENCES quotations (id);
ALTER TABLE quotation_terms ADD CONSTRAINT FKckqqdxo8e0uu9hrqsdkvqo9ef FOREIGN KEY (quotation_id) REFERENCES quotations (id);
ALTER TABLE quotations ADD CONSTRAINT FKqbayeu4gm7plcim3dli0qn7nt FOREIGN KEY (approved_by_id) REFERENCES users (id);
ALTER TABLE quotations ADD CONSTRAINT FKo661ry8er42tgawpt3rvo1xxk FOREIGN KEY (boq_id) REFERENCES boqs (id);
ALTER TABLE quotations ADD CONSTRAINT FKbv6vp77w2lpnag5v0b8keobm9 FOREIGN KEY (customer_id) REFERENCES customers (id);
ALTER TABLE quotations ADD CONSTRAINT FK24aji64ib7pgrmhoagqnt7s7y FOREIGN KEY (lead_id) REFERENCES leads (id);
ALTER TABLE quotations ADD CONSTRAINT FK7xghwkf1c6nrb4ybq288pyijg FOREIGN KEY (measurement_id) REFERENCES measurements (id);
ALTER TABLE quotations ADD CONSTRAINT FK8fu9de6f32q1l75bsqifsivfj FOREIGN KEY (prepared_by_id) REFERENCES users (id);
ALTER TABLE quotations ADD CONSTRAINT FKgt6k5fvukgukeh64t5rrqgso6 FOREIGN KEY (project_id) REFERENCES projects (id);
ALTER TABLE quotations ADD CONSTRAINT FK2u0cc7q670c5thyxwmsxr0a8l FOREIGN KEY (reviewed_by_id) REFERENCES users (id);
ALTER TABLE quotations ADD CONSTRAINT FK5xo2i0rkm5rjsrbdrq858hbkj FOREIGN KEY (site_visit_id) REFERENCES site_visits (id);
ALTER TABLE refresh_tokens ADD CONSTRAINT FK1lih5y2npsf8u5o3vhdb9y0os FOREIGN KEY (user_id) REFERENCES users (id);
ALTER TABLE role_permissions ADD CONSTRAINT FKegdk29eiy7mdtefy5c7eirr6e FOREIGN KEY (permission_id) REFERENCES permissions (id);
ALTER TABLE role_permissions ADD CONSTRAINT FKn5fotdgk8d1xvo8nav9uv3muc FOREIGN KEY (role_id) REFERENCES roles (id);
ALTER TABLE salary_records ADD CONSTRAINT FKdglsilrqla44otqyp86elb7el FOREIGN KEY (employee_id) REFERENCES employees (id);
ALTER TABLE site_measurements ADD CONSTRAINT FK2k6q4wdee5k4ruvn7sscvxkyt FOREIGN KEY (site_room_id) REFERENCES site_rooms (id);
ALTER TABLE site_rooms ADD CONSTRAINT FKe6kn1uhxuamlks6fr73xyu681 FOREIGN KEY (site_visit_id) REFERENCES site_visits (id);
ALTER TABLE site_visit_assignments ADD CONSTRAINT FKhxdm80x82ad9np8mo58csnu90 FOREIGN KEY (assigned_by_user_id) REFERENCES users (id);
ALTER TABLE site_visit_assignments ADD CONSTRAINT FKigtwlyoeg3c30fjdrvxqbht9 FOREIGN KEY (assigned_user_id) REFERENCES users (id);
ALTER TABLE site_visit_assignments ADD CONSTRAINT FKa6afjgtqwpprvtd2hv2ip8s9j FOREIGN KEY (site_visit_id) REFERENCES site_visits (id);
ALTER TABLE site_visit_checklists ADD CONSTRAINT FKc88m0m62xgdkbvlfaky49avr7 FOREIGN KEY (site_visit_id) REFERENCES site_visits (id);
ALTER TABLE site_visit_history ADD CONSTRAINT FKh63iu6ruaesv97ob65hhqddes FOREIGN KEY (performed_by_user_id) REFERENCES users (id);
ALTER TABLE site_visit_history ADD CONSTRAINT FK1kambhj8bu8phrrvvmf2cskst FOREIGN KEY (site_visit_id) REFERENCES site_visits (id);
ALTER TABLE site_visit_media ADD CONSTRAINT FK4tfu48p1gqtqj47ymk6v1bjnx FOREIGN KEY (site_visit_id) REFERENCES site_visits (id);
ALTER TABLE site_visit_media ADD CONSTRAINT FK963965ck5k9h50c76htx3jgu6 FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id);
ALTER TABLE site_visits ADD CONSTRAINT FK1g08iy7jpnog5k4v94dvacka7 FOREIGN KEY (customer_id) REFERENCES customers (id);
ALTER TABLE site_visits ADD CONSTRAINT FKqagv0sf62257iooa3byi3n1wl FOREIGN KEY (follow_up_from_id) REFERENCES site_visits (id);
ALTER TABLE site_visits ADD CONSTRAINT FKivuci6gpclr0as1vxu86r43tu FOREIGN KEY (lead_id) REFERENCES leads (id);
ALTER TABLE site_visits ADD CONSTRAINT FKr75vud862r3dg6jupu6pppuiv FOREIGN KEY (next_visit_assigned_to) REFERENCES users (id);
ALTER TABLE site_visits ADD CONSTRAINT FK9xoae5ha849ienbjxx8c4i5to FOREIGN KEY (project_id) REFERENCES projects (id);
ALTER TABLE task_assignments ADD CONSTRAINT FKtovnr7ljpnvn7expvkeptfyel FOREIGN KEY (assigned_by_id) REFERENCES users (id);
ALTER TABLE task_assignments ADD CONSTRAINT FKnc5hikg2wiusrsw2qwmxyog6h FOREIGN KEY (employee_id) REFERENCES users (id);
ALTER TABLE task_assignments ADD CONSTRAINT FKk36vhf9tt6t3woselwnkis6v6 FOREIGN KEY (task_id) REFERENCES tasks (id);
ALTER TABLE task_attachments ADD CONSTRAINT FK4eyiisq4wyx2mfj3p9h8ppufo FOREIGN KEY (task_id) REFERENCES tasks (id);
ALTER TABLE task_checklist_items ADD CONSTRAINT FKrjcf699bf964rfbmhq46twir7 FOREIGN KEY (checklist_id) REFERENCES task_checklists (id);
ALTER TABLE task_checklists ADD CONSTRAINT FKdrt19ij3qf43oaeouxdfsd8c5 FOREIGN KEY (task_id) REFERENCES tasks (id);
ALTER TABLE task_comments ADD CONSTRAINT FKtbd7uwo21s4shik5f0mghfk21 FOREIGN KEY (author_id) REFERENCES users (id);
ALTER TABLE task_comments ADD CONSTRAINT FK9517viwn2geh1gpivj6l9y64u FOREIGN KEY (task_id) REFERENCES tasks (id);
ALTER TABLE task_dependencies ADD CONSTRAINT FKnwfxktx9emcwsylqofad5cxbx FOREIGN KEY (dependency_id) REFERENCES tasks (id);
ALTER TABLE task_dependencies ADD CONSTRAINT FKerlktvi2bud6uauih348u0loj FOREIGN KEY (task_id) REFERENCES tasks (id);
ALTER TABLE task_time_logs ADD CONSTRAINT FK3fliynm1ra9wei6aj4c33gs6a FOREIGN KEY (employee_id) REFERENCES users (id);
ALTER TABLE task_time_logs ADD CONSTRAINT FKjw8l4l5mrd64ka7dn7q8janpl FOREIGN KEY (task_id) REFERENCES tasks (id);
ALTER TABLE tasks ADD CONSTRAINT FK7iqrtjp2fehh8fpmy5ptd425u FOREIGN KEY (assigned_employee_id) REFERENCES users (id);
ALTER TABLE tasks ADD CONSTRAINT FKodpp4v5c0qtw2vctq25fe6h4w FOREIGN KEY (contractor_id) REFERENCES contractors (id);
ALTER TABLE tasks ADD CONSTRAINT FK76tiq4q248au3u79a8nkexoth FOREIGN KEY (parent_task_id) REFERENCES tasks (id);
ALTER TABLE tasks ADD CONSTRAINT FKr7a4f8pud1sl9wt7342n2i2am FOREIGN KEY (phase_id) REFERENCES project_phases (id);
ALTER TABLE tasks ADD CONSTRAINT FKsfhn82y57i3k9uxww1s007acc FOREIGN KEY (project_id) REFERENCES projects (id);
ALTER TABLE tasks ADD CONSTRAINT FK9330n67hpxtnvj6w5xhtpmwgy FOREIGN KEY (room_id) REFERENCES project_rooms (id);
ALTER TABLE user_roles ADD CONSTRAINT FKh8ciramu9cc9q3qcqiv4ue8a6 FOREIGN KEY (role_id) REFERENCES roles (id);
ALTER TABLE user_roles ADD CONSTRAINT FKhfh9dx7w3ubf1co1vdev94g3f FOREIGN KEY (user_id) REFERENCES users (id);
ALTER TABLE verification_tokens ADD CONSTRAINT FK54y8mqsnq1rtyf581sfmrbp4f FOREIGN KEY (user_id) REFERENCES users (id);

SET FOREIGN_KEY_CHECKS = 1;
