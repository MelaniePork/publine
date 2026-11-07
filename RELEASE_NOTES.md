<div dir="rtl" align="right">

# یادداشت انتشار · نسخهٔ ۱٫۰٫۳

**NIGHTLINE · نسخهٔ Railway — نسخهٔ ۱٫۰٫۳**

این نسخه سه چیز را عوض می‌کند: پنل دیگر بدون متغیرها و والیوم بالا نمی‌آید، پیام‌های کوتاه (نوتیف) دیگر از کادر پنل بیرون نمی‌زنند، و قوانین مسیریابی ایران به‌صورت پیش‌فرض به همهٔ فایل‌های اشتراک اضافه شده‌اند.

---

## راه‌اندازی اجباری

- **`PORT=8080` و `DATA_DIR=/data` حالا اجباری‌اند.** پنل پیش از بالا آمدن آن‌ها را بررسی می‌کند؛ اگر نباشند، در لاگ یک جعبهٔ `REFUSING TO START` با نام دقیق مورد و راه‌حل چاپ می‌شود و پروسه عمداً متوقف می‌شود.
- **والیوم اجباری است.** اگر والیومی روی `DATA_DIR` وصل نباشد (یا `DATA_DIR` بیرون والیوم باشد) پنل کرش می‌کند — چون در آن حالت هر ری‌استارت همهٔ کاربران و لینک‌ها را پاک می‌کند.
- بررسی والیوم هم با `RAILWAY_VOLUME_MOUNT_PATH` انجام می‌شود و هم با تشخیص اینکه `DATA_DIR` واقعاً یک mount است؛ پس هر دو روش اتصال والیوم پوشش داده می‌شود.
- برای اجرای محلی، `NL_ALLOW_EPHEMERAL=1` این بررسی را به هشدار تبدیل می‌کند (روی Railway استفاده نشود).

## مسیریابی ایران

- **تب تازهٔ «مسیریابی»** با دکمه‌های روشن/خاموش و DNS انتخاب‌شدنی؛ همه‌چیز از اول **روشن** است.
- **ایران مستقیم:** دامنه‌های ایرانی با `geosite:ir` / `geosite:category-ir` و آی‌پی‌ها با `geoip:ir` بدون تونل رد می‌شوند.
- **بستن تبلیغات و بدافزار:** `category-ads-all`، `ads`، `malware`، `phishing`، `cryptominers` و لیست آی‌پی امنیتی.
- **بستن QUIC (اختیاری)** و **DNS تفکیک‌شده** (شکن / رادار / الکترو / DoH).
- قوانین در **سه فرمت** نوشته می‌شوند: `routing` در کانفیگ Xray، `rule_set` در کانفیگ sing-box، و `rule-providers` در YAML کلش.
- دانلود `geosite.dat` و `geoip.dat` از GitHub و CDN داخل همان تب است؛ اگر از فایل‌های پیش‌فرض Xray استفاده می‌کنید، گزینهٔ «فایل‌های قوانین ایران نصب است» را خاموش کنید.
- کانفیگ تولیدی در هر دو حالت با `xray -test` و `sing-box check` اعتبارسنجی شده است.

## ظاهر

- **رفع باگ نوتیف:** پیام‌های کوتاه دیگر به‌خاطر یک انیمیشن جابه‌جایی از لبهٔ صفحه بیرون نمی‌زنند؛ متن می‌شکند، به عرض صفحه محدود است و در گوشی هم کامل دیده می‌شود.
- نوار تب‌ها برای ده بخش بازچینش شد تا همه در یک ردیف جا شوند.

---


# Release notes · v1.0.3 (English)

- **Mandatory setup:** `PORT=8080` and `DATA_DIR=/data` are now required, and a volume must be mounted on `DATA_DIR`. The panel audits this before it starts and prints a `REFUSING TO START` box naming the missing item (it exits instead of running without persistence).
- **Iran routing:** a new *Routing* tab (on by default) adds Iranian split routing to every subscription file — Iranian domains/IPs direct via `geosite:ir` / `geoip:ir`, ads/malware/phishing blocked, optional QUIC block and split DNS (Shecan / Radar / Electro / DoH). Emitted as `routing` for Xray, remote `rule_set` for sing-box and `rule-providers` for Clash; generated configs are validated with `xray -test` and `sing-box check`.
- **Toast fix:** short messages no longer slide out of the viewport and are clamped, wrapped and mobile-safe.
- **Tab strip** now keeps all ten sections on one row.

---

<details>
<summary><b>نسخهٔ ۱٫۰٫۲ — یادداشت قبلی</b></summary>



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

</details>

</div>
