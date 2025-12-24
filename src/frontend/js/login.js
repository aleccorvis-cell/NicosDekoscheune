document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const forgotBtn = document.getElementById('forgotPasswordBtn');
    const resetConfirmation = document.getElementById('resetConfirmation');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Hide previous errors
        errorMessage.classList.add('hidden');

        // Disable button to prevent double submit (optional refinement)
        const submitButton = loginForm.querySelector('button[type="submit"]');
        const originalBtnText = submitButton.innerText;
        submitButton.disabled = true;
        submitButton.innerText = 'Lade...';

        const formData = new FormData(loginForm);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                // Success
                window.location.href = '/admin/dashboard'; // Redirect placeholder
            } else {
                // Error from server
                showError(result.error || 'Ein Fehler ist aufgetreten.');
            }
        } catch (error) {
            console.error('Login request failed', error);
            showError('Verbindung zum Server fehlgeschlagen.');
        } finally {
            submitButton.disabled = false;
            submitButton.innerText = originalBtnText;
        }
    });

    // Password Reset
    if (forgotBtn) {
        forgotBtn.addEventListener('click', async () => {
            if (!confirm('Soll ein Link zum Zurücksetzen des Passworts an die Admin-E-Mail gesendet werden?')) {
                return;
            }

            forgotBtn.disabled = true;
            forgotBtn.textContent = 'Wird gesendet...';

            try {
                const response = await fetch('/api/admin/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                const result = await response.json();

                if (response.ok) {
                    resetConfirmation.classList.remove('hidden');
                    forgotBtn.classList.add('hidden');
                } else {
                    alert('Fehler: ' + (result.error || 'Unbekannter Fehler'));
                }
            } catch (error) {
                console.error('Password reset failed', error);
                alert('Verbindung zum Server fehlgeschlagen.');
            } finally {
                forgotBtn.disabled = false;
                forgotBtn.textContent = 'Passwort vergessen?';
            }
        });
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }
});
