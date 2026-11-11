
/* ==========================================
   SCHOOL NEWS - CONTENT LOADER
   Complete & Fixed Version
========================================== */


/* ==========================================
   CONFIGURATION
========================================== */

const CONFIG = {
    owner: "mohammadmedi",
    repository: "school-news",
    branch: "main"
};

const API_BASE =
    `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repository}/contents`;

const RAW_BASE =
    `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.repository}/${CONFIG.branch}`;


/* ==========================================
   HELPER FUNCTIONS
========================================== */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}


function cleanValue(value) {

    value = String(value ?? "").trim();

    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        value = value.slice(1, -1);
    }

    if (value === "true") return true;
    if (value === "false") return false;

    if (value === "null" || value === "~") return null;

    return value;
}


function getImageUrl(path) {

    if (!path || typeof path !== "string") {
        return "";
    }

    path = path.trim();

    if (!path) return "";

    // External image URL
    if (/^https?:\/\//i.test(path)) {

        try {

            const url = new URL(path);

            if (
                url.protocol === "https:" ||
                url.protocol === "http:"
            ) {
                return url.href;
            }

            return "";

        } catch {
            return "";
        }
    }

    // GitHub repository image
    path = path.replace(/^\/+/, "");

    return `${RAW_BASE}/${path
        .split("/")
        .map(part => encodeURIComponent(part))
        .join("/")}`;
}


function formatDate(date) {

    if (!date) return "";

    return escapeHTML(date);
}


function renderEmpty(container, message) {

    if (!container) return;

    container.innerHTML = `
        <p class="empty-state">
            ${escapeHTML(message)}
        </p>
    `;
}


function renderImage(path, alt = "", lazy = true, className = "news-image") {

    const image = getImageUrl(path);

    if (!image) return "";

    return `
        <img
            class="${escapeHTML(className)}"
            src="${escapeHTML(image)}"
            alt="${escapeHTML(alt)}"
            ${lazy ? 'loading="lazy"' : 'fetchpriority="high"'}
            decoding="async"
        >
    `;
}


/* ==========================================
   FETCH DATA FROM GITHUB
========================================== */

async function getCollection(folder) {

    const safeFolder = folder
        .split("/")
        .map(part => encodeURIComponent(part))
        .join("/");

    const response = await fetch(
        `${API_BASE}/${safeFolder}?ref=${encodeURIComponent(CONFIG.branch)}`,
        {
            headers: {
                "Accept": "application/vnd.github+json"
            }
        }
    );

    if (!response.ok) {

        throw new Error(
            `دریافت اطلاعات ${folder} ناموفق بود. کد خطا: ${response.status}`
        );
    }

    const files = await response.json();

    if (!Array.isArray(files)) {
        throw new Error(`ساختار اطلاعات ${folder} معتبر نیست.`);
    }

    const markdownFiles = files.filter(file =>
        file.type === "file" &&
        typeof file.name === "string" &&
        file.name.toLowerCase().endsWith(".md") &&
        file.download_url
    );

    const results = await Promise.all(

        markdownFiles.map(async file => {

            const fileResponse = await fetch(file.download_url);

            if (!fileResponse.ok) {

                throw new Error(
                    `خواندن فایل ${file.name} ناموفق بود.`
                );
            }

            const content = await fileResponse.text();

            return parseMarkdown(content);

        })
    );

    return results;
}


/* ==========================================
   MARKDOWN FRONT MATTER PARSER
========================================== */

function parseMarkdown(content) {

    const match = content.match(
        /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/
    );

    if (!match) {
        return {};
    }

    const metadata = {};

    const lines = match[1].split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {

        const line = lines[i];

        const field = line.match(
            /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/
        );

        if (!field) continue;

        const key = field[1];

        const value = field[2] || "";

        // Multiline YAML values
        if (value === "|" || value === ">") {

            const collected = [];

            while (
                i + 1 < lines.length &&
                /^\s+/.test(lines[i + 1])
            ) {

                i++;

                collected.push(lines[i].trim());
            }

            metadata[key] = value === "|"
                ? collected.join("\n")
                : collected.join(" ");

        } else {

            metadata[key] = cleanValue(value);

        }
    }

    return metadata;
}


/* ==========================================
   FILTER AND SORT PUBLISHED CONTENT
========================================== */

function publishedItems(items) {

    return items

        .filter(item => item.published === true)

        .sort((a, b) =>
            String(b.date || "").localeCompare(
                String(a.date || "")
            )
        );
}


/* ==========================================
   RENDER FEATURED NEWS
========================================== */

function renderFeaturedNews(items) {

    const container = document.getElementById("featured-news");

    if (!container) return;

    const featured = items.find(
        item => item.featured === true
    );

    if (!featured) {

        container.innerHTML = "";

        return;
    }

    container.innerHTML = `

        <article class="news-card featured-card">

            ${renderImage(
        featured.image,
        featured.title || "خبر ویژه",
        false
    )}

            <div class="card-content">

                <span class="featured-label">
                    خبر داغ
                </span>

                <h3>
                    ${escapeHTML(featured.title || "")}
                </h3>

                <p>
                    ${escapeHTML(featured.summary || "")}
                </p>

                <small>
                    ${formatDate(featured.date)}
                </small>

            </div>

        </article>

    `;
}


/* ==========================================
   RENDER SCHOOL NEWS
========================================== */

function renderNews(items) {

    const container = document.getElementById("news-list");

    if (!container) return;

    const normalNews = items.filter(
        item => item.featured !== true
    );

    if (normalNews.length === 0) {

        renderEmpty(
            container,
            "هنوز خبری منتشر نشده است."
        );

        return;
    }

    container.innerHTML = normalNews.map(item => `

        <article class="news-card">

            ${renderImage(
        item.image,
        item.title || "تصویر خبر"
    )}

            <div class="card-content">

                <span class="category">
                    ${escapeHTML(item.category || "عمومی")}
                </span>

                <h3>
                    ${escapeHTML(item.title || "")}
                </h3>

                <p>
                    ${escapeHTML(item.summary || "")}
                </p>

                <small>
                    ${formatDate(item.date)}
                </small>

            </div>

        </article>

    `).join("");
}


/* ==========================================
   RENDER SCHOOL CALENDAR
========================================== */

function renderCalendar(items) {

    const container = document.getElementById("calendar-list");

    if (!container) return;

    if (items.length === 0) {

        renderEmpty(
            container,
            "برنامه‌ای ثبت نشده است."
        );

        return;
    }

    container.innerHTML = items.map(item => `

        <article class="calendar-card">

            <div class="calendar-date">
                ${formatDate(item.date)}
            </div>

            <div class="calendar-info">

                <h3>
                    ${escapeHTML(item.title || "")}
                </h3>

                <span>
                    ${escapeHTML(item.event_type || "رویداد")}
                </span>

                <p>
                    ${escapeHTML(item.description || "")}
                </p>

            </div>

        </article>

    `).join("");
}


/* ==========================================
   RENDER SCHOOL HONORS
========================================== */

function renderHonors(items) {

    const container = document.getElementById("honors-list");

    if (!container) return;

    if (items.length === 0) {

        renderEmpty(
            container,
            "هنوز افتخاری ثبت نشده است."
        );

        return;
    }

    container.innerHTML = items.map(item => `

        <article class="honor-card">

            ${renderImage(
        item.image,
        item.title || "تصویر افتخار",
        true,
        "honor-image"
    )}

            <div class="card-content">

                <h3>
                    ${escapeHTML(item.title || "")}
                </h3>

                <p>
                    ${escapeHTML(item.recipient || "")}
                </p>

                <p>
                    ${escapeHTML(item.description || "")}
                </p>

                <small>
                    ${formatDate(item.date)}
                </small>

            </div>

        </article>

    `).join("");
}


/* ==========================================
   LOAD NEWS
========================================== */

async function loadNews() {

    const container = document.getElementById("news-list");

    try {

        const items = await getCollection("content/news");

        const published = publishedItems(items);

        renderFeaturedNews(published);

        renderNews(published);

    } catch (error) {

        console.error("خطا در دریافت اخبار:", error);

        renderEmpty(
            container,
            "دریافت اخبار با مشکل مواجه شد."
        );

        const featuredContainer =
            document.getElementById("featured-news");

        if (featuredContainer) {
            featuredContainer.innerHTML = "";
        }
    }
}


/* ==========================================
   LOAD CALENDAR
========================================== */

async function loadCalendar() {

    const container = document.getElementById("calendar-list");

    try {

        const items = await getCollection("content/calendar");

        const published = publishedItems(items);

        renderCalendar(published);

    } catch (error) {

        console.error("خطا در دریافت تقویم:", error);

        renderEmpty(
            container,
            "دریافت تقویم با مشکل مواجه شد."
        );
    }
}


/* ==========================================
   LOAD HONORS
========================================== */

async function loadHonors() {

    const container = document.getElementById("honors-list");

    try {

        const items = await getCollection("content/honors");

        const published = publishedItems(items);

        renderHonors(published);

    } catch (error) {

        console.error("خطا در دریافت افتخارات:", error);

        renderEmpty(
            container,
            "دریافت افتخارات با مشکل مواجه شد."
        );
    }
}


/* ==========================================
   INITIALIZE APPLICATION
========================================== */

function initializeSchoolNews() {

    loadNews();

    loadCalendar();

    loadHonors();
}


/* ==========================================
   START APPLICATION
========================================== */

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initializeSchoolNews,
        { once: true }
    );

} else {

    initializeSchoolNews();

}
