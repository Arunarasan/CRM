const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'pages');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace import
    content = content.replace(/import axios from "axios";/g, 'import api from "@/lib/api";');
    
    // Replace axios.get/post/put/delete with api.get/post/put/delete
    content = content.replace(/axios\.get/g, 'api.get');
    content = content.replace(/axios\.post/g, 'api.post');
    content = content.replace(/axios\.put/g, 'api.put');
    content = content.replace(/axios\.delete/g, 'api.delete');

    // Remove http://localhost:8080/api from URLs
    content = content.replace(/`http:\/\/localhost:8080\/api/g, '`');
    content = content.replace(/"http:\/\/localhost:8080\/api/g, '"');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
}
