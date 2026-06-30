document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const rsvpForm = document.getElementById('rsvp-form');
    const successMessage = document.getElementById('success-message');
    const successText = document.getElementById('success-text');
    const btnReset = document.getElementById('btn-reset');
    const btnSubmit = document.getElementById('btn-submit');
    const radioPresenca = document.getElementsByName('presenca');
    const acompanhantesGroup = document.getElementById('acompanhantes-group');
    const selectAcompanhantes = document.getElementById('acompanhantes');

    // Admin Elements
    const btnAdminTrigger = document.getElementById('btn-admin-trigger');
    const adminModal = document.getElementById('admin-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const adminLoginForm = document.getElementById('admin-login-form');
    const adminLoginSection = document.getElementById('admin-login-section');
    const adminDashboardSection = document.getElementById('admin-dashboard-section');
    const adminPasswordInput = document.getElementById('admin-password');
    const loginError = document.getElementById('login-error');
    
    // Admin Dashboard Elements
    const statTotalPresencas = document.getElementById('stat-total-presencas');
    const statTotalAcompanhantes = document.getElementById('stat-total-acompanhantes');
    const statTotalRecusas = document.getElementById('stat-total-recusas');
    const guestListBody = document.getElementById('guest-list-body');
    const btnExportCsv = document.getElementById('btn-export-csv');
    const btnClearData = document.getElementById('btn-clear-data');

    // Configs
    const ADMIN_PASSWORD = "4586"; // Senha padrão (Número da Loja)
    const STORAGE_KEY = "masonic_rsvp_guests";

    let activeUnsubscribe = null;
    let cachedGuests = []; // Guarda dados carregados (local ou nuvem) para exportação

    // Toggle Acompanhantes view based on presence selection
    radioPresenca.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'nao') {
                acompanhantesGroup.classList.add('hidden');
                selectAcompanhantes.value = "0";
            } else {
                acompanhantesGroup.classList.remove('hidden');
            }
        });
    });

    // Handle Form Submission
    rsvpForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Get Form Values
        const nome = document.getElementById('nome').value.trim();
        const loja = document.getElementById('loja').value.trim();
        const cim = document.getElementById('cim').value.replace(/\D/g, '').slice(0, 10);
        const presenca = document.querySelector('input[name="presenca"]:checked').value;
        const acompanhantes = parseInt(selectAcompanhantes.value) || 0;
        const observacoes = document.getElementById('observacoes').value.trim();
        const dataRegistro = new Date().toLocaleString('pt-BR');

        // Validate
        if (!nome) return;

        const rsvpData = { nome, loja, cim, presenca, acompanhantes, observacoes, date: dataRegistro };

        // UI Loading
        btnSubmit.disabled = true;
        const originalText = btnSubmit.innerHTML;
        btnSubmit.innerHTML = 'Enviando... <i class="fa-solid fa-circle-notch fa-spin"></i>';

        try {
            await saveRSVP(rsvpData);

            // Update Success Message UI
            if (presenca === 'sim') {
                successText.textContent = `Sua presença foi confirmada com sucesso. Agradecemos e nos vemos no dia 05/07 às 08h!`;
            } else {
                successText.textContent = `Agradecemos por nos informar. Sua ausência foi registrada.`;
            }

            // Hide Form, Show Success
            rsvpForm.classList.add('hidden');
            successMessage.classList.remove('hidden');
        } catch (error) {
            console.error("Erro ao registrar RSVP:", error);
            alert("Ocorreu um erro ao salvar sua confirmação. Por favor, tente novamente.");
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = originalText;
        }
    });

    // Reset Form for another submission
    btnReset.addEventListener('click', () => {
        rsvpForm.reset();
        rsvpForm.classList.remove('hidden');
        successMessage.classList.add('hidden');
        acompanhantesGroup.classList.remove('hidden');
    });

    // Modal Control: Open
    btnAdminTrigger.addEventListener('click', () => {
        adminModal.classList.remove('hidden');
        adminPasswordInput.focus();
    });

    // Modal Control: Close
    btnCloseModal.addEventListener('click', () => {
        closeAdminModal();
    });

    // Close on clicking outside modal content
    adminModal.addEventListener('click', (e) => {
        if (e.target === adminModal) {
            closeAdminModal();
        }
    });

    // Handle Admin Login
    adminLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const password = adminPasswordInput.value;

        if (password === ADMIN_PASSWORD) {
            loginError.classList.add('hidden');
            adminLoginSection.classList.add('hidden');
            adminDashboardSection.classList.remove('hidden');
            loadAdminDashboard();
        } else {
            loginError.classList.remove('hidden');
            adminPasswordInput.value = "";
            adminPasswordInput.focus();
        }
    });

    // Export Guest List to CSV
    btnExportCsv.addEventListener('click', () => {
        if (cachedGuests.length === 0) {
            alert("Não há dados para exportar.");
            return;
        }

        let csvContent = "\uFEFF"; // UTF-8 BOM for Excel
        csvContent += "Nome;Loja;CIM;Presenca;Acompanhantes;Observacoes;Data de Registro\n";

        cachedGuests.forEach(g => {
            const row = [
                g.nome,
                g.loja || "N/A",
                g.cim || "N/A",
                g.presenca === 'sim' ? 'Confirmado' : 'Não comparecerá',
                g.acompanhantes,
                g.observacoes.replace(/\n/g, " ") || "",
                g.date
            ].map(val => `"${val}"`).join(";");
            csvContent += row + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "lista_convidados_sessao_exaltacao.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Clear Data
    btnClearData.addEventListener('click', async () => {
        if (confirm("Tem certeza de que deseja apagar permanentemente todas as confirmações da lista? Esta ação não pode ser desfeita.")) {
            if (typeof isFirebaseConfigured !== 'undefined' && isFirebaseConfigured && db) {
                try {
                    btnClearData.disabled = true;
                    const originalText = btnClearData.innerHTML;
                    btnClearData.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Limpando nuvem...';
                    
                    const querySnapshot = await db.collection("convidados").get();
                    const batch = db.batch();
                    querySnapshot.forEach((doc) => {
                        batch.delete(doc.ref);
                    });
                    await batch.commit();
                    
                    alert("Lista limpa com sucesso no Firebase!");
                } catch (error) {
                    console.error("Erro ao limpar dados no Firebase:", error);
                    alert("Erro ao limpar dados. Verifique as regras de segurança do seu Firestore.");
                } finally {
                    btnClearData.disabled = false;
                    btnClearData.innerHTML = '<i class="fa-solid fa-trash-can"></i> Limpar Lista';
                }
            } else {
                localStorage.removeItem(STORAGE_KEY);
                loadAdminDashboard();
            }
        }
    });

    // Save RSVP (Firebase or Local)
    function saveRSVP(rsvp) {
        if (typeof isFirebaseConfigured !== 'undefined' && isFirebaseConfigured && db) {
            return db.collection("convidados").add(rsvp);
        } else {
            return new Promise((resolve) => {
                const guests = getGuestsLocal();
                guests.push(rsvp);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(guests));
                resolve();
            });
        }
    }

    // Get Local Guests
    function getGuestsLocal() {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    }

    // Close Admin Panel
    function closeAdminModal() {
        if (activeUnsubscribe) {
            activeUnsubscribe();
            activeUnsubscribe = null;
        }
        adminModal.classList.add('hidden');
        adminPasswordInput.value = "";
        loginError.classList.add('hidden');
        adminLoginSection.classList.remove('hidden');
        adminDashboardSection.classList.add('hidden');
    }

    // Load Admin Dashboard (with Live Updates if Firebase)
    function loadAdminDashboard() {
        if (typeof isFirebaseConfigured !== 'undefined' && isFirebaseConfigured && db) {
            // Spinner/Loading state
            guestListBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-gray); padding: 30px;">
                        <i class="fa-solid fa-circle-notch fa-spin"></i> Carregando dados da nuvem...
                    </td>
                </tr>
            `;

            // Active Realtime Listener
            activeUnsubscribe = db.collection("convidados").onSnapshot((querySnapshot) => {
                const firebaseGuests = [];
                querySnapshot.forEach((doc) => {
                    firebaseGuests.push(doc.data());
                });

                // Ordena localmente por data de registro decrescente (mais recente primeiro)
                firebaseGuests.sort((a, b) => {
                    const parseDate = (dateStr) => {
                        if (!dateStr) return 0;
                        const [d, t] = dateStr.split(' ');
                        const [day, month, year] = d.split('/').map(Number);
                        const [hour, min, sec] = t ? t.split(':').map(Number) : [0, 0, 0];
                        return new Date(year, month - 1, day, hour, min, sec).getTime();
                    };
                    return parseDate(b.date) - parseDate(a.date);
                });

                cachedGuests = firebaseGuests;
                renderDashboardData(firebaseGuests);
            }, (error) => {
                console.error("Erro no listener do Firebase:", error);
                guestListBody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; color: var(--danger); padding: 30px;">
                            Erro ao sincronizar dados. Verifique a configuração de segurança das regras do Firestore.
                        </td>
                    </tr>
                `;
            });
        } else {
            // Modo Local
            cachedGuests = getGuestsLocal().reverse();
            renderDashboardData(cachedGuests);
        }
    }

    // Render Dashboard Data (Stats + Table)
    function renderDashboardData(guests) {
        // Calculate Stats
        let totalSim = 0;
        let totalNao = 0;
        let totalAcompanhantes = 0;

        guests.forEach(g => {
            if (g.presenca === 'sim') {
                totalSim++;
                totalAcompanhantes += g.acompanhantes;
            } else {
                totalNao++;
            }
        });

        statTotalPresencas.textContent = totalSim;
        statTotalAcompanhantes.textContent = totalAcompanhantes;
        statTotalRecusas.textContent = totalNao;

        // Populate Table
        guestListBody.innerHTML = "";

        if (guests.length === 0) {
            guestListBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-gray); padding: 30px;">
                        Nenhuma confirmação registrada até o momento.
                    </td>
                </tr>
            `;
            return;
        }

        guests.forEach(g => {
            const tr = document.createElement('tr');
            
            const statusBadge = g.presenca === 'sim' 
                ? `<span style="color: var(--success); font-weight: 600;"><i class="fa-solid fa-check"></i> Sim</span>`
                : `<span style="color: var(--danger); font-weight: 600;"><i class="fa-solid fa-xmark"></i> Não</span>`;

            tr.innerHTML = `
                <td style="font-weight: 500;">${escapeHtml(g.nome)}</td>
                <td>${escapeHtml(g.loja || '-')}</td>
                <td>${escapeHtml(g.cim || '-')}</td>
                <td>${statusBadge}</td>
                <td>${g.presenca === 'sim' ? g.acompanhantes : '-'}</td>
                <td title="${escapeHtml(g.observacoes)}">${escapeHtml(truncateString(g.observacoes, 30))}</td>
                <td style="color: var(--text-gray); font-size: 0.8rem;">${g.date.split(' ')[0]}</td>
            `;
            guestListBody.appendChild(tr);
        });
    }

    // Helper functions
    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function truncateString(str, num) {
        if (!str) return '';
        if (str.length <= num) return str;
        return str.slice(0, num) + '...';
    }
});
