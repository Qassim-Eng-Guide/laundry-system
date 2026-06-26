// دالة إنشاء الفاتورة وإرسال الواتساب السليمة
async function submitInvoiceAndWhatsApp(phone, services, total) {
    const username = localStorage.getItem('username') || 'admin';

    try {
        // 1. إرسال البيانات إلى السيرفر (حفظ الفاتورة في قاعدة البيانات السحابية)
        const response = await fetch('/api/create-invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_phone: phone,
                services: services,
                total_amount: total,
                created_by: username
            })
        });

        const data = await response.json();

        if (data.success) {
            // 2. تعديل الرقم ليتوافق مع مفتاح السعودية تلقائياً
            let formattedPhone = phone;
            if (formattedPhone.startsWith('0')) {
                formattedPhone = '966' + formattedPhone.substring(1);
            }

            // 3. تجهيز نص رسالة الفاتورة
            const message = `مرحباً بك في المغسلة 👕\nتم إصدار فاتورتك برقم: ${data.invoice_code}\nالمبلغ الإجمالي: ${total} ريال.\nشكراً لتعاملك معنا!`;

            // 4. فتح الواتساب بطريقة صحيحة تمنع مشكلة about:blank
            const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
            
        } else {
            alert('حدث خطأ أثناء حفظ الفاتورة في النظام.');
        }
    } catch (error) {
        console.error('خطأ في الاتصال:', error);
        alert('تعذر الاتصال بالسيرفر.');
    }
}