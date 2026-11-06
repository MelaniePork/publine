<div dir="rtl" align="right">

# یادداشت انتشار · نسخهٔ ۱٫۰٫۲

**NIGHTLINE · نسخهٔ Railway — نسخهٔ ۱٫۰٫۲**

این نسخه روی «کارکرد واقعی» تمرکز دارد: فقط روش‌هایی که روی ریلوی جواب می‌دهند پیش‌فرض روشن‌اند، پنل خودش را از مخزن به‌روز می‌کند و ظاهر پنل مرتب و روان شده است.

---

## اتصال و کانفیگ

- **فقط ترکیب‌های کارآمد پیش‌فرض‌اند:** VLESS·REALITY، Shadowsocks-2022 و AnyTLS روی پورت TCP پروکسی. MTProto، SOCKS5 و HTTP هم مثل قبل روی همان پورت سرو می‌شوند.
- **روش‌های دامنه‌محور** (WS / XHTTP / HTTPUpgrade / gRPC / VMess-WS) از پیش‌فرض خارج و با برچسب **LAB** در تب «روش‌های اتصال» نگه داشته شدند — برای کسانی که دامنهٔ اختصاصی دارند.
- **اصلاح ALPN:** لینک‌های WebSocket دیگر `h2` پیشنهاد نمی‌کنند؛ همین یک قلم باعث می‌شد همهٔ لینک‌های دامنه‌ای بی‌پاسخ بمانند.
- **پروفایل‌های تنظیم آسان** بازنویسی شدند: «ایران · پایدارترین» (پیش‌فرض)، «سبک · فقط REALITY» و «آزمایشی · همهٔ روش‌ها».
- **پینگ واقعی هر لینک** در پنجرهٔ لینک‌های کاربر، با یک TCP handshake برای هر مقصد.
- اشتراک‌های Xray و sing-box با تنظیمات جدید (DoH و Fragment) دوباره اعتبارسنجی شدند.

## به‌روزرسانی

- **به‌روزرسانی از داخل پنل:** تنظیمات → «به‌روزرسانی از مخزن». نسخهٔ نصب‌شده با آخرین ریلیز مقایسه می‌شود، خلاصهٔ تغییرات نمایش داده می‌شود و با یک دکمه فایل‌ها جایگزین و پنل ری‌استارت می‌شود. داده‌ها و کاربران دست‌نخورده می‌مانند.

## رابط کاربری

- **رفع متن خام:** پیام‌های کوتاه (مثل خطای تب Railynx) دیگر تگ HTML نشان نمی‌دهند و متن هر دو زبان درست رندر می‌شود.
- **فاصله‌گذاری سراسری:** ریتم عمودی یکسان، فاصلهٔ کارت‌ها، جدول‌ها، فرم‌ها و دکمه‌ها بازچینش شد؛ هیچ کارتی به همسایه‌اش نمی‌چسبد و فضای خالی بی‌مورد نمانده است.
- **انیمیشن‌های نرم:** یک منحنی easing مشترک برای تب‌ها، کارت‌ها، دکمه‌ها و پیام‌ها؛ با احترام به `prefers-reduced-motion`.
- **نوار وضعیت** با کارت‌های جدا و مقادیر کامل (بدون شکستن پورت وسط عدد).
- **آیکون‌ها:** آیکون‌های گیت‌هاب و تلگرام در کل پنل درست نمایش داده می‌شوند.

## پاک‌سازی

- **اعتبار شخص ثالث فقط در تب Railynx** ذکر می‌شود؛ از فوتر، تنظیمات و سایر بخش‌ها حذف شد.
- **نصب‌کنندهٔ خط فرمان حذف شد** (فقط یک لینک تزئینی در README بود)؛ به‌جایش به‌روزرسانی از داخل پنل آمده است.
- نسخهٔ README و تصاویر آن بازتولید شد.

## اصلاحات تکمیلی ۱٫۰٫۲

- **کارت «درباره و مخزن پروژه»:** نام و آیدی شخص ثالث حذف شد؛ فقط لینک مخزن پروژه مانده است. اعتبار ثالث فقط در تب Railynx است.
- **تب تنظیمات:** کارت‌ها در سه ردیف جفت‌شده چیده شدند و فضای خالیِ پایین صفحه و تکرار نوار رایگان از بین رفت. کارت «دربارهٔ این نصب» به‌جای جدول بلند، دو ستون خوانا شد.
- **زیرنویس سرصفحه:** عبارت اضافهٔ «روی پلن رایگان ریلوی» حذف شد.
- **پاورقی:** خط پاورقی دیگر به نوار بالای خودش نمی‌چسبد؛ فاصله و خط جداکنندهٔ نقطه‌چین دارد.
- **به‌روزرسانی روی صفحهٔ اصلی:** یک نوار وضعیت بالای صفحهٔ داشبورد نسخهٔ نصب‌شده و آخرین نسخه را نشان می‌دهد؛ اگر نسخهٔ تازه باشد هشدار متحرک همراه دکمهٔ «به‌روزرسانی درجا» ظاهر می‌شود و دکمهٔ «بررسی دوباره» هم دستی بررسی می‌کند.
- پنل حالا همیشه آخرین فایل‌های خودش را بارگذاری می‌کند (پیش‌تر مرورگر نسخهٔ قدیمی را نگه می‌داشت).

---

# Release notes · v1.0.2 (English)

- **Defaults are now only what actually works on Railway:** VLESS·REALITY, Shadowsocks-2022 and AnyTLS over the TCP proxy port, plus MTProto / SOCKS5 / HTTP for Telegram.
- **Domain-based recipes** (WS, XHTTP, HTTPUpgrade, gRPC, VMess-WS) are no longer enabled by default and are labelled **LAB**; the ALPN bug that made every domain link time out is fixed (`http/1.1` only for WebSocket).
- **Easy-setup profiles** rewritten: *Iran (default)*, *Light (REALITY only)*, *Lab (everything)*.
- **Real per-link ping** in the user links dialog (one TCP handshake per endpoint).
- **In-panel updater:** Settings → *Update from repository* compares the installed version with the newest release, shows the changelog and replaces the code files, then restarts. The data volume is untouched.
- **UI:** raw HTML in toasts fixed, one shared spacing rhythm, no more touching cards, smooth shared easing curve (with `prefers-reduced-motion` support), readable status board, working GitHub/Telegram icons.
- **Cleanup:** third-party credit now lives only inside the Railynx tab; the decorative CLI installer was removed from the README.

## v1.0.2 follow-up fixes

- **About card:** the third-party name/handle is gone; only the project repository chip remains. Credit stays inside the Railynx tab.
- **Settings tab:** cards are paired in three balanced rows, the dangling empty space and the duplicated free strip are gone, and "About this deployment" is a two-column fact grid instead of a ten-row table.
- **Masthead subline:** the redundant "on the Railway free plan" phrase was removed.
- **Footer:** the footer line no longer sticks to the strip above it; it has a dotted separator and proper spacing.
- **Update banner on the main page:** the dashboard shows the installed vs. latest version; a new release produces an animated badge with an "update in place" button, plus a manual re-check.
- The panel now always loads its own latest assets instead of the browser caching an old bundle.

</div>
