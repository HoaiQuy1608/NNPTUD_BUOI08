const mongoose = require('mongoose');
const exceljs = require('exceljs');
const crypto = require('crypto');
const path = require('path');

// Import schemas and utils
const userModel = require('./schemas/users');
const roleModel = require('./schemas/roles');
const mailHandler = require('./utils/senMailHandler');

async function importUsers() {
    try {
        // 3. Đọc file user.xlsx
        const workbook = new exceljs.Workbook();
        const filePath = path.join(__dirname, 'user.xlsx');
        
        try {
            await workbook.xlsx.readFile(filePath);
        } catch (fileErr) {
            console.error(`Không thể đọc file excel tại ${filePath}: ${fileErr.message}`);
            return;
        }

        const worksheet = workbook.worksheets[0];
        const usersToCreate = [];

        // 4. Lấy dữ liệu (bỏ qua dòng tiêu đề 1)
        for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
            const row = worksheet.getRow(rowNumber);
            let username = row.getCell(1).value;
            let email = row.getCell(2).value;

            // Xử lý trường hợp ô chứa công thức (formula)
            if (username && typeof username === 'object' && username.result) {
                username = username.result;
            }
            if (email && typeof email === 'object' && email.result) {
                email = email.result;
            }

            // Bỏ qua dòng trống
            if (!username || !email) continue;

            // Random chuỗi 16 kí tự (16 hex chars = 8 bytes)
            const randomPassword = crypto.randomBytes(8).toString('hex');

            usersToCreate.push({
                username: username.toString().trim(),
                email: email.toString().trim(),
                password: randomPassword
            });
        }

        console.log(`Tìm thấy ${usersToCreate.length} dữ liệu người dùng trong file Excel.`);

        // 5. Gửi email (Không lưu DB)
        for (let i = 0; i < usersToCreate.length; i++) {
            const userData = usersToCreate[i];
            try {
                // Gửi email thông báo password
                try {
                    await mailHandler.sendPasswordMail(userData.email, userData.username, userData.password);
                    console.log(`Thành công: Đã gửi email chứa mật khẩu tới '${userData.email}' cho user '${userData.username}'`);
                    
                    // Thêm delay 1 giây để tránh lỗi "Too many emails per second" từ Mailtrap
                    if (i < usersToCreate.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } catch (mailErr) {
                    console.error(`Thất bại: Không thể gửi email tới '${userData.email}': ${mailErr.message}`);
                }
            } catch (err) {
                console.error(`Lỗi khi xử lý user '${userData.username}':`, err.message);
            }
        }

        console.log("\n--- HOÀN TẤT GỬI EMAIL ---");
    } catch (error) {
        console.error("Lỗi chương trình:", error);
    }
}

// Chạy script
importUsers();
