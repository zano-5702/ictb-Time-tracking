"use strict";

const utils = require("@iobroker/adapter-core");

class MyTimeAdapter extends utils.Adapter {
    constructor(options) {
        super({
            ...options,
            name: "my-time-adapter",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }

    async onReady() {
        this.log.info("Adapter my-time-adapter gestartet.");

        // Lies config.customers
        const customers = this.config.customers || [];
        this.log.info(`Anzahl Kunden: ${customers.length}`);
        customers.forEach((cust, idx) => {
            this.log.info(`Kunde ${idx}: Name=${cust.name}, Adresse=${cust.address}, Satz=${cust.hourlyRate}`);
        });

        // Hier kannst du States anlegen oder Zeitlogik starten ...
    }

    onUnload(callback) {
        try {
            this.log.info("my-time-adapter wird gestoppt...");
            callback();
        } catch (e) {
            callback();
        }
    }
}

if (require.main !== module) {
    module.exports = (options) => new MyTimeAdapter(options);
} else {
    new MyTimeAdapter();
}
