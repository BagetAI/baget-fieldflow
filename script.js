document.addEventListener('DOMContentLoaded', () => {
    const waitlistForm = document.getElementById('waitlist-form');
    const formMessage = document.getElementById('form-message');

    if (waitlistForm) {
        waitlistForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = waitlistForm.querySelector('button');
            const originalBtnText = submitBtn.innerText;
            submitBtn.innerText = 'Joining...';
            submitBtn.disabled = true;

            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                role: document.getElementById('role').value,
                location: document.getElementById('location').value
            };

            try {
                const response = await fetch('https://baget.ai/api/public/databases/e32f6392-951a-4b08-92a0-6425257c24a4/rows', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ data: formData }),
                });

                if (response.ok) {
                    formMessage.textContent = 'Success! Welcome to the FieldFlow pilot. We will contact you shortly.';
                    formMessage.style.color = '#FFFFFF';
                    formMessage.classList.remove('hidden');
                    waitlistForm.reset();
                    waitlistForm.classList.add('hidden');
                } else {
                    throw new Error('Failed to join waitlist');
                }
            } catch (error) {
                console.error('Error:', error);
                formMessage.textContent = 'Something went wrong. Please try again.';
                formMessage.style.color = '#FF6B35';
                formMessage.classList.remove('hidden');
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }
});