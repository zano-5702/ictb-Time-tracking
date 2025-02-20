"use strict";

const utils = require("@iobroker/adapter-core");
const puppeteer = require("puppeteer-core");
const fs = require("fs");

class MyTimeAdapter extends utils.Adapter {
    constructor(options) {
        super({
            ...options,
            name: "my-time-adapter",
        });
        this.on("ready", this.onReady.bind(this));
    }

    async onReady() {
        this.log.info("Adapter my-time-adapter gestartet. Teste Puppeteer-Core...");

        try {
            // 1) Pfad zu deinem Chrome/Chromium:
            //    z. B. /usr/bin/google-chrome oder /usr/bin/chromium
            const executablePath = "/usr/bin/google-chrome";

            // 2) Browser starten (evtl. Sandbox-Flags, wenn LXC)
            const browser = await puppeteer.launch({
                executablePath: executablePath,
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox"
                ]
            });

            // 3) Seite anlegen
            const page = await browser.newPage();
            await page.setContent(`
                <h1>Hallo Welt!</h1>
                <p>PDF-Test mit Puppeteer-Core + lokalem Chrome.</p>
            `);

            // 4) PDF erzeugen
            const pdfPath = "/opt/iobroker/test.pdf";
            await page.pdf({ path: pdfPath, format: "A4" });

            await browser.close();
            this.log.info(`Puppeteer-Core: Test-PDF erstellt unter ${pdfPath}`);
        } catch (err) {
            this.log.error("Fehler beim PDF-Erzeugen mit Puppeteer-Core: " + (err && err.message));
        }
    }
}

if (require.main !== module) {
    module.exports = (options) => new MyTimeAdapter(options);
} else {
    new MyTimeAdapter();
}
