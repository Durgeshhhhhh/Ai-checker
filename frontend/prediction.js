const APP_CONFIG = window.APP_CONFIG || {};
const API_BASE = APP_CONFIG.API_BASE || "";

if (APP_CONFIG.IS_API_PLACEHOLDER || !APP_CONFIG.API_BASE) {
    console.warn("Set your Render backend URL in frontend/config.js before production deploy.");
}

const token = localStorage.getItem("access_token");
let user = null;
try {
    user = JSON.parse(localStorage.getItem("user") || "null");
} catch (error) {
    localStorage.removeItem("user");
    user = null;
}

if (!token || !user) {
    window.location.href = "login.html";
}

const header = document.getElementById("siteHeader");
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");
const userInfo = document.getElementById("userInfo");

if (userInfo && user && user.email) {
    userInfo.innerText = user.email;
}

const adminNavLink = document.getElementById("adminNavLink");
if (adminNavLink && user && user.role === "admin") {
    adminNavLink.style.display = "inline-flex";
}

function closeMenu() {
    if (!navLinks || !menuBtn) return;
    navLinks.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
}
window.closeMenu = closeMenu;

if (menuBtn && navLinks) {
    menuBtn.addEventListener("click", () => {
        const willOpen = !navLinks.classList.contains("open");
        navLinks.classList.toggle("open", willOpen);
        menuBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });
}

document.querySelectorAll(".nav-links-wrap a").forEach((link) => {
    link.addEventListener("click", closeMenu);
});

window.addEventListener("resize", () => {
    if (window.innerWidth > 900) {
        closeMenu();
    }
});

window.addEventListener("scroll", () => {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 18);
});

function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    window.location.href = "index.html";
}
window.logout = logout;

let lastPredictionData = null;
let loadingInterval = null;
let selectedFileBaseName = "";
const loadingMessages = [
    "Reading sentence patterns...",
    "Comparing AI and human writing signals...",
    "Scoring confidence across segments...",
    "Preparing your result report..."
];

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getSafeUserSlug() {
    const email = user && user.email ? user.email : "user";
    return email.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
}

function getSafeFileBaseName(filename) {
    const name = String(filename || "").trim();
    if (!name) return "";
    const dotIndex = name.lastIndexOf(".");
    const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
    return base.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").toLowerCase();
}

function setUxMessage(message, type = "info") {
    const uxMessage = document.getElementById("uxMessage");
    uxMessage.className = `ux-message show ${type}`;
    uxMessage.innerText = message;
}

function clearUxMessage() {
    const uxMessage = document.getElementById("uxMessage");
    uxMessage.className = "ux-message";
    uxMessage.innerText = "";
}

function startLoading(initialText = "Analyzing...") {
    const loading = document.getElementById("loading");
    const loadingMessage = document.getElementById("loadingMessage");
    let idx = 0;

    loading.hidden = false;
    loadingMessage.innerText = initialText;

    if (loadingInterval) {
        clearInterval(loadingInterval);
    }

    loadingInterval = setInterval(() => {
        idx = (idx + 1) % loadingMessages.length;
        loadingMessage.innerText = loadingMessages[idx];
    }, 1500);
}

function stopLoading() {
    const loading = document.getElementById("loading");
    const loadingMessage = document.getElementById("loadingMessage");
    loading.hidden = true;
    loadingMessage.innerText = "";
    if (loadingInterval) {
        clearInterval(loadingInterval);
        loadingInterval = null;
    }
}

function renderDonut(aiValue, humanValue) {
    const donut = document.getElementById("donutChart");
    const ai = Math.max(0, Math.min(100, Number(aiValue) || 0));
    const human = Math.max(0, Math.min(100, Number(humanValue) || 0));
    const aiDeg = (ai / 100) * 360;

    donut.style.background = `conic-gradient(#ef4444 0deg ${aiDeg}deg, #10b981 ${aiDeg}deg 360deg)`;
    donut.innerHTML = `
        <div class="donut-inner">
            <strong>AI ${ai}%</strong>
            <span>Human ${human}%</span>
        </div>
    `;
}

async function loadHistory() {
    const historyList = document.getElementById("historyList");
    if (!historyList) return;

    if (!API_BASE) {
        historyList.innerHTML = "<div class='history-item'>Backend URL not configured.</div>";
        return;
    }

    const valOrZero = (v) => (v === null || v === undefined ? 0 : v);

    try {
        const response = await fetch(API_BASE + "/my-history", {
            headers: { Authorization: "Bearer " + token }
        });

        const data = await response.json().catch(() => null);

        if (!response.ok || !Array.isArray(data)) {
            historyList.innerHTML = "<div class='history-item'>Unable to load history.</div>";
            return;
        }

        data.sort((a, b) => {
            const aTime = a && a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const bTime = b && b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return bTime - aTime;
        });

        const recent = data.slice(0, 3);

        if (!recent.length) {
            historyList.innerHTML = "<div class='history-item'>No scans yet.</div>";
            return;
        }

        historyList.innerHTML = recent.map((log) => {
            const time = log && log.timestamp ? new Date(log.timestamp).toLocaleString() : "N/A";
            const scanned = log && log.scanned_text ? String(log.scanned_text) : "";
            const preview = scanned.slice(0, 300);
            const suffix = scanned.length > 300 ? "..." : "";

            const result = escapeHtml(log && log.result ? log.result : "N/A");
            const ai = valOrZero(log && log.ai_percent);
            const human = valOrZero(log && log.human_percent);

            return (
                '<div class="history-item">' +
                    '<div class="history-meta">' +
                        "Result: " + result + " | " +
                        "AI: " + ai + "% | " +
                        "Human: " + human + "% | " +
                        "Time: " + escapeHtml(time) +
                    "</div>" +
                    '<p class="history-text">' +
                        escapeHtml(preview) + suffix +
                    "</p>" +
                "</div>"
            );
        }).join("");
    } catch (error) {
        historyList.innerHTML = "<div class='history-item'>Unable to load history.</div>";
    }
}

function clearText() {
    document.getElementById("textInput").value = "";
    document.getElementById("fileInput").value = "";
    const selectedFile = document.getElementById("selectedFileName");
    if (selectedFile) {
        selectedFile.hidden = true;
        selectedFile.innerText = "";
    }
    selectedFileBaseName = "";
    document.getElementById("highlightedText").innerHTML = "";
    document.getElementById("overallStats").innerHTML = "";
    document.getElementById("resultSummary").innerHTML = "";
    document.getElementById("donutChart").innerHTML = "";
    document.getElementById("results").style.display = "none";
    lastPredictionData = null;
    stopLoading();
    clearUxMessage();
}
window.clearText = clearText;

function renderPrediction(data) {
    renderDonut(data.overall_ai_probability, data.overall_human_probability);

    const overallStats = document.getElementById("overallStats");
    overallStats.innerHTML = `
        <span class="overall-pill human-pill">Human: ${data.overall_human_probability}%</span>
        <span class="overall-pill ai-pill">AI: ${data.overall_ai_probability}%</span>
    `;

    const aiPercent = Number(data.overall_ai_probability || 0);
    const humanPercent = Number(data.overall_human_probability || 0);
    const confidenceGap = Math.abs(humanPercent - aiPercent);
    const verdict = aiPercent > humanPercent ? "Likely AI-Generated" : "Likely Human-Written";
    const summary = document.getElementById("resultSummary");
    summary.innerHTML = `
        <article class="summary-card">
            <h4>Final Verdict</h4>
            <p>${verdict}</p>
        </article>
        <article class="summary-card">
            <h4>Confidence Gap</h4>
            <p>${confidenceGap.toFixed(1)}%</p>
        </article>
        <article class="summary-card">
            <h4>Sentences Reviewed</h4>
            <p>${data.sentences && data.sentences.length ? data.sentences.length : 0}</p>
        </article>
    `;

    const box = document.getElementById("highlightedText");
    box.innerHTML = "";
    data.sentences.forEach((s) => {
        const span = document.createElement("span");
        span.innerText = s.sentence + " ";
        span.className = String(s.final_label || "human").toLowerCase();
        box.appendChild(span);
    });

    document.getElementById("results").style.display = "block";
    lastPredictionData = data;
    setUxMessage("Analysis complete. You can copy the result text or download a report.", "success");
}

function handlePredictionError(response, data) {
    stopLoading();
    if (response.status === 401) {
        alert("Session expired. Please login again.");
        logout();
        return;
    }
    if (response.status === 402) {
        alert("No tokens left. Contact admin.");
        return;
    }
    setUxMessage((data && data.detail) ? data.detail : "Prediction failed", "error");
}

async function analyzeText() {
    const text = document.getElementById("textInput").value.trim();
    if (!text) return alert("Please enter some text.");
    if (!API_BASE) return alert("Backend URL is not configured. Set it in frontend/config.js");

    clearUxMessage();
    startLoading("Analyzing document...");

    try {
        const response = await fetch(API_BASE + "/predict", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ text: text })
        });

        const data = await response.json();
        if (!response.ok) {
            handlePredictionError(response, data);
            return;
        }

        renderPrediction(data);
        setUxMessage("Analysis complete. Tokens left: " + data.tokens_left, "success");
        loadHistory();
    } catch (error) {
        setUxMessage("Server not reachable. Please try again.", "error");
    } finally {
        stopLoading();
    }
}
window.analyzeText = analyzeText;

async function analyzeFile() {
    const fileInput = document.getElementById("fileInput");
    const textInput = document.getElementById("textInput");
    const selectedFileEl = document.getElementById("selectedFileName");
    if (!fileInput.files.length) return alert("Please choose a file to extract.");
    if (!API_BASE) return alert("Backend URL is not configured. Set it in frontend/config.js");

    const pickedFile = fileInput.files[0];
    selectedFileBaseName = getSafeFileBaseName(pickedFile.name);
    if (selectedFileEl) {
        selectedFileEl.hidden = false;
        selectedFileEl.innerText = `Selected file: ${pickedFile.name} (Extracting...)`;
    }

    const formData = new FormData();
    formData.append("file", pickedFile);

    clearUxMessage();
    startLoading("Extracting text from file...");
    try {
        const response = await fetch(API_BASE + "/extract-file", {
            method: "POST",
            headers: { Authorization: "Bearer " + token },
            body: formData
        });

        const data = await response.json();
        if (!response.ok) {
            if (response.status === 401) {
                alert("Session expired. Please login again.");
                logout();
                return;
            }
            setUxMessage((data && data.detail) ? data.detail : "File extraction failed", "error");
            return;
        }

        textInput.value = data.text || "";
        setUxMessage("Extracted " + (data.characters || 0) + " characters. Click Analyze to scan.", "info");
        if (selectedFileEl) {
            selectedFileEl.hidden = false;
            selectedFileEl.innerText = `Selected file: ${pickedFile.name} (Ready for scan)`;
        }
    } catch (error) {
        setUxMessage("Unable to extract file right now. Please try again.", "error");
        if (selectedFileEl) {
            selectedFileEl.hidden = false;
            selectedFileEl.innerText = `Selected file: ${pickedFile.name} (Extraction failed)`;
        }
    } finally {
        stopLoading();
    }
}
window.analyzeFile = analyzeFile;

async function copyResultText() {
    if (!lastPredictionData) {
        setUxMessage("Run an analysis first to copy result text.", "error");
        return;
    }
    const text = lastPredictionData.sentences
        .map((s, idx) => `${idx + 1}. [${s.final_label}] ${s.sentence}`)
        .join("\n");

    try {
        await navigator.clipboard.writeText(text);
        setUxMessage("Result text copied to clipboard.", "success");
    } catch (error) {
        setUxMessage("Unable to copy automatically. Please copy manually.", "error");
    }
}
window.copyResultText = copyResultText;

async function downloadReport() {
    if (!lastPredictionData) {
        setUxMessage("Run an analysis first before downloading the report.", "error");
        return;
    }
    if (!window.jspdf || !window.jspdf.jsPDF) {
        setUxMessage("PDF libraries failed to load. Refresh and try again.", "error");
        return;
    }

    const now = new Date();
    const datePart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const timePart = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    const baseName = selectedFileBaseName || getSafeUserSlug();
    const fileName = `${baseName}_ai_highlight_report_${datePart}.pdf`;
    const reportId = `RQ-${datePart.replace(/-/g, "")}-${timePart}`;
    const logoSrc = window.REQUIN_LOGO_URL || "./requin-logo.png";

    const logoAsset = await new Promise((resolve) => {
        const probe = new Image();
        probe.crossOrigin = "anonymous";
        probe.onload = () => {
            try {
                const cv = document.createElement("canvas");
                cv.width = probe.naturalWidth;
                cv.height = probe.naturalHeight;
                const ctx = cv.getContext("2d");
                if (!ctx) {
                    resolve(null);
                    return;
                }
                ctx.drawImage(probe, 0, 0);
                resolve({
                    dataUrl: cv.toDataURL("image/png"),
                    width: probe.naturalWidth || 0,
                    height: probe.naturalHeight || 0
                });
            } catch (error) {
                resolve(null);
            }
        };
        probe.onerror = () => resolve(null);
        probe.src = logoSrc;
    });

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 24;
        const headerHeight = 56;
        const contentWidth = pageWidth - margin * 2;
        const contentBottom = pageHeight - margin;
        const rowGap = 8;
        const rowPaddingY = 8;
        const rowPaddingX = 10;
        const rowLineHeight = 16;
        const rowFontSize = 11;
        const rowTextWidth = contentWidth - rowPaddingX * 2 - 26;
        let y = margin + headerHeight + 18;
        let pageIndex = 0;

        const drawHeader = () => {
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, pageWidth, headerHeight + 18, "F");

            let textX = margin;
            if (logoAsset && logoAsset.dataUrl && logoAsset.width && logoAsset.height) {
                const maxLogoW = 130;
                const maxLogoH = 34;
                const ratio = Math.min(maxLogoW / logoAsset.width, maxLogoH / logoAsset.height);
                const logoW = Math.max(1, Math.round(logoAsset.width * ratio));
                const logoH = Math.max(1, Math.round(logoAsset.height * ratio));
                pdf.addImage(logoAsset.dataUrl, "PNG", margin, 14, logoW, logoH, undefined, "FAST");
                textX = margin + logoW + 10;
            }

            pdf.setTextColor(15, 23, 42);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(14);
            pdf.text("AI Text Detector", textX, 28);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(11);
            pdf.text("by Requin Solutions", textX, 43);

            pdf.setDrawColor(226, 232, 240);
            pdf.line(margin, headerHeight + 6, pageWidth - margin, headerHeight + 6);
        };

        const drawWatermark = () => {
            const centerX = pageWidth / 2;
            const centerY = pageHeight / 2 + 12;
            pdf.setTextColor(207, 218, 237);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(46);
            pdf.text("REQUIN SOLUTIONS", centerX, centerY, { align: "center", angle: -28 });
            pdf.setTextColor(15, 23, 42);
        };

        const drawPill = (x, yTop, text, fillRgb) => {
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(12);
            const w = pdf.getTextWidth(text) + 18;
            const h = 24;
            pdf.setFillColor(fillRgb[0], fillRgb[1], fillRgb[2]);
            pdf.roundedRect(x, yTop, w, h, 12, 12, "F");
            pdf.setTextColor(255, 255, 255);
            pdf.text(text, x + 9, yTop + 16);
            pdf.setTextColor(15, 23, 42);
            return w;
        };

        const drawDetailIntro = (continued) => {
            const gradSteps = 22;
            const titleY = y;
            for (let i = 0; i < gradSteps; i++) {
                const t = i / (gradSteps - 1);
                const r = Math.round(15 * (1 - t) + 30 * t);
                const g = Math.round(23 * (1 - t) + 64 * t);
                const b = Math.round(42 * (1 - t) + 175 * t);
                pdf.setFillColor(r, g, b);
                pdf.rect(margin + (contentWidth / gradSteps) * i, titleY, contentWidth / gradSteps + 1, 48, "F");
            }
            pdf.setTextColor(248, 250, 252);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(23);
            pdf.text(continued ? "Detailed Report (Continued)" : "Detailed AI Report", pageWidth / 2, titleY + 31, { align: "center" });
            y += 66;

            pdf.setDrawColor(203, 213, 225);
            pdf.setFillColor(255, 255, 255);
            pdf.roundedRect(margin, y, contentWidth, 26, 8, 8, "FD");
            pdf.setTextColor(15, 23, 42);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(14);
            pdf.text("Highlighted Extracted Text", margin + 12, y + 17);
            y += 36;
        };

        const drawScoreCard = (x, yTop, width, height, title, score, fillRgb) => {
            pdf.setFillColor(fillRgb[0], fillRgb[1], fillRgb[2]);
            pdf.roundedRect(x, yTop, width, height, 12, 12, "F");
            pdf.setTextColor(255, 255, 255);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(10);
            pdf.text(title, x + 12, yTop + 16);
            pdf.setFontSize(23);
            pdf.text(`${score}%`, x + 12, yTop + 39);
            pdf.setTextColor(15, 23, 42);
        };

        const beginPage = () => {
            if (pageIndex > 0) {
                pdf.addPage();
            }
            drawHeader();
            y = margin + headerHeight + 18;
            drawWatermark();
            pageIndex += 1;
        };

        const beginCoverPage = () => {
            const aiScore = Number(lastPredictionData.overall_ai_probability || 0);
            const humanScore = Number(lastPredictionData.overall_human_probability || 0);
            const allSentences = (lastPredictionData.sentences || []).map((s) => ({
                text: String(s.sentence || "").trim(),
                isAi: String(s.final_label || "human").toLowerCase() === "ai"
            }));
            const totalCount = allSentences.length;
            const aiCount = allSentences.filter((s) => s.isAi).length;
            const humanCount = totalCount - aiCount;
            const aiRatio = totalCount ? Math.round((aiCount / totalCount) * 100) : 0;
            const humanRatio = totalCount ? Math.round((humanCount / totalCount) * 100) : 0;
            const verdict = aiScore >= humanScore ? "Likely AI-generated content" : "Likely human-written content";
            const confidence = aiScore >= humanScore ? aiScore : humanScore;
            const risk = aiScore >= 80 ? "High Risk" : aiScore >= 50 ? "Medium Risk" : "Low Risk";
            const riskColor = aiScore >= 80 ? [220, 38, 38] : aiScore >= 50 ? [217, 119, 6] : [5, 150, 105];
            const topHighlights = allSentences
                .filter((s) => s.isAi && s.text)
                .slice(0, 4)
                .map((s) => s.text);
            const cardGap = 14;
            const cardW = (contentWidth - cardGap) / 2;

            beginPage();
            pdf.setTextColor(15, 23, 42);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(24);
            pdf.text("AI Writing Detection Report", margin, y + 16);
            y += 34;

            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(12);
            pdf.setTextColor(71, 85, 105);
            pdf.text("Automated overview with clear risk indicators and summary insights.", margin, y + 12);
            y += 28;

            pdf.setDrawColor(226, 232, 240);
            pdf.line(margin, y, pageWidth - margin, y);
            y += 18;

            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(11);
            pdf.setTextColor(51, 65, 85);
            pdf.text(`Generated at: ${now.toLocaleString()}`, margin, y);
            pdf.text(`File/User: ${baseName}`, pageWidth - margin, y, { align: "right" });
            y += 18;

            drawScoreCard(margin, y, cardW, 54, "AI Probability", lastPredictionData.overall_ai_probability, [220, 38, 38]);
            drawScoreCard(margin + cardW + cardGap, y, cardW, 54, "Human Probability", lastPredictionData.overall_human_probability, [5, 150, 105]);
            y += 72;

            pdf.setFillColor(241, 245, 249);
            pdf.roundedRect(margin, y, contentWidth, 92, 12, 12, "F");
            pdf.setTextColor(15, 23, 42);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(14);
            pdf.text("Overall Verdict", margin + 14, y + 24);
            pdf.setFillColor(riskColor[0], riskColor[1], riskColor[2]);
            pdf.roundedRect(pageWidth - margin - 110, y + 10, 96, 20, 8, 8, "F");
            pdf.setTextColor(255, 255, 255);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(10);
            pdf.text(risk, pageWidth - margin - 62, y + 24, { align: "center" });
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(20);
            pdf.setTextColor(15, 23, 42);
            pdf.text(verdict, margin + 14, y + 52);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(12);
            pdf.setTextColor(71, 85, 105);
            pdf.text(`Confidence: ${confidence}%`, margin + 14, y + 74);
            y += 106;

            pdf.setFillColor(248, 250, 252);
            pdf.roundedRect(margin, y, contentWidth, 86, 12, 12, "F");
            pdf.setTextColor(15, 23, 42);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(13);
            pdf.text("Document Overview", margin + 14, y + 22);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(11);
            pdf.text(`Total Sentences: ${totalCount}`, margin + 14, y + 42);
            pdf.text(`AI-Labeled Sentences: ${aiCount}`, margin + 14, y + 60);
            pdf.text(`Human-Labeled Sentences: ${humanCount}`, margin + 14, y + 78);
            pdf.text(`AI Ratio: ${aiRatio}%`, margin + contentWidth / 2 + 14, y + 42);
            pdf.text(`Human Ratio: ${humanRatio}%`, margin + contentWidth / 2 + 14, y + 60);
            y += 98;

            pdf.setFillColor(248, 250, 252);
            pdf.roundedRect(margin, y, contentWidth, 118, 12, 12, "F");
            pdf.setTextColor(15, 23, 42);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(13);
            pdf.text("Top AI-Flagged Highlights", margin + 14, y + 22);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(10.5);
            const previewLines = topHighlights.length ? topHighlights : ["No AI-flagged highlights found."];
            let hy = y + 40;
            for (let i = 0; i < Math.min(previewLines.length, 4); i++) {
                const wrapped = pdf.splitTextToSize(`- ${previewLines[i]}`, contentWidth - 28);
                const firstLine = wrapped[0] || "";
                pdf.text(firstLine, margin + 14, hy);
                hy += 18;
            }
            y += 130;

            pdf.setFillColor(241, 245, 249);
            pdf.roundedRect(margin, y, contentWidth, 74, 12, 12, "F");
            pdf.setTextColor(15, 23, 42);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(12);
            pdf.text("Report Metadata", margin + 14, y + 20);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(10.5);
            pdf.text(`Report ID: ${reportId}`, margin + 14, y + 38);
            pdf.text(`Generated: ${now.toLocaleString()}`, margin + 14, y + 54);
            pdf.text(`Source: ${baseName}`, margin + contentWidth / 2 + 14, y + 38);
            pdf.text("Quick Notes:", margin + contentWidth / 2 + 14, y + 54);
            pdf.text("- Page 2 onward contains sentence-level detail.", margin + contentWidth / 2 + 14, y + 68);
        };

        const beginDetailPage = (continued) => {
            beginPage();
            drawDetailIntro(continued);
        };

        const rows = (lastPredictionData.sentences || []).map((s) => ({
            text: String(s.sentence || ""),
            isAi: String(s.final_label || "human").toLowerCase() === "ai"
        }));
        if (!rows.length) {
            rows.push({ text: "(No highlighted output available)", isAi: false });
        }

        beginCoverPage();
        beginDetailPage(false);
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(rowFontSize);
            let lines = pdf.splitTextToSize(row.text, rowTextWidth);
            let rowHeight = lines.length * rowLineHeight + rowPaddingY * 2;

            if (y + rowHeight > contentBottom) {
                beginDetailPage(true);
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(rowFontSize);
                lines = pdf.splitTextToSize(row.text, rowTextWidth);
                rowHeight = lines.length * rowLineHeight + rowPaddingY * 2;
            }

            if (row.isAi) {
                pdf.setFillColor(255, 237, 237);
                pdf.roundedRect(margin, y, contentWidth, rowHeight, 8, 8, "F");
                pdf.setFillColor(220, 38, 38);
                pdf.rect(margin, y, 3, rowHeight, "F");
                pdf.setTextColor(111, 24, 24);
            } else {
                pdf.setFillColor(220, 252, 231);
                pdf.roundedRect(margin, y, contentWidth, rowHeight, 8, 8, "F");
                pdf.setFillColor(16, 185, 129);
                pdf.rect(margin, y, 3, rowHeight, "F");
                pdf.setTextColor(20, 83, 45);
            }

            const textX = margin + rowPaddingX;
            let textY = y + rowPaddingY + 10;
            for (let j = 0; j < lines.length; j++) {
                pdf.text(lines[j], textX, textY);
                textY += rowLineHeight;
            }
            y += rowHeight + rowGap;
        }

        pdf.save(fileName);
        setUxMessage(`Report downloaded as ${fileName}`, "success");
    } catch (error) {
        setUxMessage("Unable to generate PDF report. Please try again.", "error");
    }
}
window.downloadReport = downloadReport;

const analyzeBtn = document.getElementById("analyzeBtn");
const analyzeFileBtn = document.getElementById("analyzeFileBtn");
const clearBtn = document.getElementById("clearBtn");
const downloadBtn = document.getElementById("downloadBtn");
const copyResultBtn = document.getElementById("copyResultBtn");
const logoutBtn = document.getElementById("logoutBtn");
const fileInputEl = document.getElementById("fileInput");
const selectedFileNameEl = document.getElementById("selectedFileName");

if (analyzeBtn) analyzeBtn.addEventListener("click", analyzeText);
if (analyzeFileBtn) analyzeFileBtn.addEventListener("click", analyzeFile);
if (clearBtn) clearBtn.addEventListener("click", clearText);
if (downloadBtn) downloadBtn.addEventListener("click", downloadReport);
if (copyResultBtn) copyResultBtn.addEventListener("click", copyResultText);
if (logoutBtn) logoutBtn.addEventListener("click", () => {
    logout();
    closeMenu();
});
if (fileInputEl) {
    fileInputEl.addEventListener("change", async () => {
        const file = fileInputEl.files && fileInputEl.files[0];
        if (!file) {
            selectedFileBaseName = "";
            if (selectedFileNameEl) {
                selectedFileNameEl.hidden = true;
                selectedFileNameEl.innerText = "";
            }
            return;
        }

        selectedFileBaseName = getSafeFileBaseName(file.name);
        if (selectedFileNameEl) {
            selectedFileNameEl.hidden = false;
            selectedFileNameEl.innerText = `Selected file: ${file.name} (Auto extracting...)`;
        }

        await analyzeFile();

        if (selectedFileNameEl) {
            selectedFileNameEl.innerText = `Selected file: ${file.name} (Ready for scan)`;
        }
    });
}

loadHistory();
