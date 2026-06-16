module.exports = `
CREATE TABLE IF NOT EXISTS description_points (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    service_id INTEGER,

    quotation_item_id INTEGER,

    invoice_item_id INTEGER,

    point_order INTEGER DEFAULT 1,

    point_text TEXT NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (service_id)
        REFERENCES services(id),

    FOREIGN KEY (quotation_item_id)
        REFERENCES quotation_items(id),

    FOREIGN KEY (invoice_item_id)
        REFERENCES invoice_items(id)
);
`;