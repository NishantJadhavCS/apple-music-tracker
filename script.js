const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

async function loadData() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        processAndRenderData(data);
    } catch (error) {
        console.error("Failed to load data:", error);
        const container = document.getElementById('accordion-container');
        container.innerHTML = `
            <div class="error-message">
                <p>Failed to load data.json</p>
                <p style="font-size: 0.85rem; font-weight: 500; margin-top: 1rem; opacity: 0.7;">
                    Please ensure data.json is present and you are using a local web server.
                </p>
            </div>
        `;
    }
}

function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
}

// Calculate the cumulative expiry date based on payment history
function calculateCurrentStatus(member) {
    if (!member.payments || member.payments.length === 0) return null;
    
    // Sort payments by date
    const sorted = [...member.payments].sort((a, b) => new Date(a.paid_on) - new Date(b.paid_on));
    
    let currentExpiry = null;
    let totalPaid = 0;
    let firstPaymentDate = null;

    sorted.forEach(p => {
        const pDate = new Date(p.paid_on.split('-').join('/')); // Browser-friendly date parse
        totalPaid += p.amount;
        
        if (!firstPaymentDate) firstPaymentDate = pDate;

        if (!currentExpiry || pDate > currentExpiry) {
            // New period starts from payment date if it's after previous expiry
            currentExpiry = addMonths(pDate, p.months);
        } else {
            // Extension of existing period
            currentExpiry = addMonths(currentExpiry, p.months);
        }
    });

    const msPerDay = 1000 * 60 * 60 * 24;
    const totalDurationDays = Math.round((currentExpiry - firstPaymentDate) / msPerDay);
    const remainingDays = Math.round((currentExpiry - TODAY) / msPerDay);
    
    let progressPercent = 0;
    if (totalDurationDays > 0) {
        // Progress since start of total history
        // Actually, for better UX, let's show progress of the *latest* period
        // But the user asked for cumulative, so let's stick to remaining/total
        progressPercent = (remainingDays / totalDurationDays) * 100;
        progressPercent = Math.max(0, Math.min(100, progressPercent));
    }

    return {
        expiryDate: currentExpiry,
        firstPaymentDate,
        totalPaid,
        remainingDays,
        progressPercent,
        sortedPayments: sorted
    };
}

function processAndRenderData(data) {
    let globalTotal = 0;
    
    const members = data.members.map(member => {
        const status = calculateCurrentStatus(member);
        globalTotal += status.totalPaid;
        return { ...member, ...status };
    });

    members.sort((a, b) => a.expiryDate - b.expiryDate);

    const activeMembers = members.filter(m => m.remainingDays >= 0).length;
    document.getElementById('active-count').textContent = activeMembers;

    renderAccordion(members);

    setTimeout(() => {
        document.querySelectorAll('.battery-fill').forEach(fill => {
            const width = fill.getAttribute('data-width');
            fill.style.width = width + '%';
        });
    }, 100);
}

function formatDate(date) {
    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function getStatusInfo(member) {
    let color = '#10b981'; // green
    if (member.remainingDays <= 0) color = '#ef4444';
    else if (member.progressPercent < 20) color = '#ef4444';
    else if (member.progressPercent <= 50) color = '#f59e0b';

    if (member.remainingDays < 0) {
        return {
            text: `Expired ${Math.abs(member.remainingDays)}d ago`,
            statusClass: 'status-expired',
            badgeClass: 'badge-danger',
            progressColor: color
        };
    } else if (member.remainingDays === 0) {
        return {
            text: 'Expires Today',
            statusClass: 'status-warning',
            badgeClass: 'badge-warning',
            progressColor: color
        };
    } else if (member.remainingDays < 10) {
        return {
            text: `${member.remainingDays} days left`,
            statusClass: 'status-warning',
            badgeClass: 'badge-warning',
            progressColor: color
        };
    } else {
        return {
            text: `${member.remainingDays} days left`,
            statusClass: 'status-active',
            badgeClass: 'badge-success',
            progressColor: color
        };
    }
}

function renderAccordion(members) {
    const container = document.getElementById('accordion-container');
    let html = '';

    members.forEach((m, idx) => {
        const info = getStatusInfo(m);
        const latestPayment = m.sortedPayments[m.sortedPayments.length - 1];

        html += `
            <div class="accordion-item ${info.statusClass}" id="item-${idx}">
                <div class="accordion-header" onclick="toggleAccordion(${idx})">
                    <div class="name-section">
                        <span class="member-name">${m.name}</span>
                        <span class="badge ${info.badgeClass}">${info.text}</span>
                    </div>
                    <svg class="chevron" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
                <div class="accordion-content">
                    <div class="content-inner">
                        <div class="details-grid">
                            <div class="detail-item">
                                <span class="detail-label">Total Contribution</span>
                                <span class="detail-value">₹${m.totalPaid.toLocaleString('en-IN')}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Next Renewal</span>
                                <span class="detail-value" style="color: #fff">${formatDate(m.expiryDate)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Latest Payment</span>
                                <span class="detail-value">${formatDate(new Date(latestPayment.paid_on.split('-').join('/')))}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Current Plan</span>
                                <span class="detail-value">${latestPayment.months} Month${latestPayment.months > 1 ? 's' : ''}</span>
                            </div>
                        </div>

                        <div class="battery-container">
                            <span class="detail-label" style="display: block; margin-bottom: 0.75rem;">Time Remaining</span>
                            <div class="battery-shell">
                                <div class="battery-fill" data-width="${m.progressPercent}" style="width: 0%; background-color: ${info.progressColor};"></div>
                                <div class="battery-text">${Math.round(m.progressPercent)}%</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function toggleAccordion(idx) {
    const item = document.getElementById(`item-${idx}`);
    const wasActive = item.classList.contains('active');
    
    document.querySelectorAll('.accordion-item').forEach(el => el.classList.remove('active'));
    if (!wasActive) item.classList.add('active');
}

document.addEventListener('DOMContentLoaded', loadData);
