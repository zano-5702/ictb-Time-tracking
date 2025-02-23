'use strict';

const utils = require('@iobroker/adapter-core'); // Adapter utilities

class WorkTimeAdapter extends utils.Adapter {
    constructor(options) {
        super({
            ...options,
            name: 'worktime'
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        
        // Interne Speicherung aktiver Arbeitssitzungen pro Device
        // Struktur: { "traccar.0.devices.1": { customer: "Home-Herrengasse", startTime: <timestamp>, workDescription: "" } }
        this.activeSessions = {};
    }

    async onReady() {
        // Abonniere alle Geofence-Zustände der traccar-Devices
        this.subscribeForeignStates('traccar.0.devices.*.geofences_string');

        // Beispielhafter Kundenstamm (kann auch in einem JSON-Objekt in den Adapter-Einstellungen gepflegt werden)
        this.customers = {
            "Home-Herrengasse": {
                name: "Home-Herrengasse",
                address: "Herrengasse 1, Musterstadt",
                hourlyRate: 50,
                assignment: "Installation"
            },
            "Office-Mitte": {
                name: "Office-Mitte",
                address: "Musterstraße 2, Musterstadt",
                hourlyRate: 75,
                assignment: "Consulting"
            }
            // Weitere Kunden ...
        };

        // Beispielhafter Mitarbeiterstamm (ebenfalls pflegbar über den Adapter)
        this.employees = {
            "traccar.0.devices.1": { firstName: "Max", lastName: "Mustermann" },
            "traccar.0.devices.2": { firstName: "Erika", lastName: "Musterfrau" }
            // Weitere Mitarbeiter ...
        };

        this.log.info('WorkTime Adapter gestartet.');
    }

    /**
     * Wird bei Zustandsänderungen (z. B. geofences_string) aufgerufen.
     * @param {string} id - z.B. traccar.0.devices.1.geofences_string
     * @param {object} state - Enthält den neuen Wert, Zeitstempel etc.
     */
    async onStateChange(id, state) {
        // Ignoriere leere oder nicht definierte Zustände
        if (!state || state.val === undefined) return;
        
        // Extrahiere die Geräte-ID (z.B. "traccar.0.devices.1")
        const match = id.match(/(traccar\.0\.devices\.\d+)\.geofences_string/);
        if (!match) return;
        const deviceKey = match[1];
        const employee = this.employees[deviceKey];
        if (!employee) {
            this.log.warn(`Kein Mitarbeiter für ${deviceKey} definiert.`);
            return;
        }
        
        const newValue = state.val.toString().trim();
        const timestamp = state.ts || Date.now();

        // Wenn ein gültiger Kundenname vorliegt (nicht "0", "null" oder leer)
        if (newValue && newValue !== '0' && newValue.toLowerCase() !== 'null') {
            // Eintritt in einen Kundenbereich
            if (!this.activeSessions[deviceKey]) {
                this.activeSessions[deviceKey] = {
                    customer: newValue,
                    startTime: timestamp,
                    workDescription: ""  // Hier kann später über eine UI ein Beschrieb hinzugefügt werden
                };
                this.log.info(`${employee.firstName} ${employee.lastName} betritt ${newValue} um ${new Date(timestamp).toLocaleString()}`);
            } else {
                // Falls sich der Kundenwert ändert (z.B. Wechsel von Kunde A zu Kunde B)
                if (this.activeSessions[deviceKey].customer !== newValue) {
                    await this.closeSession(deviceKey, timestamp);
                    this.activeSessions[deviceKey] = {
                        customer: newValue,
                        startTime: timestamp,
                        workDescription: ""
                    };
                    this.log.info(`${employee.firstName} ${employee.lastName} wechselt zu ${newValue} um ${new Date(timestamp).toLocaleString()}`);
                }
            }
        } else {
            // Wenn der Wert "0", leer oder null ist → Mitarbeiter verlässt den Kundenbereich
            if (this.activeSessions[deviceKey]) {
                await this.closeSession(deviceKey, timestamp);
            }
        }
    }

    /**
     * Schließt eine aktive Sitzung und erstellt einen Logeintrag.
     * @param {string} deviceKey - z.B. "traccar.0.devices.1"
     * @param {number} endTime - Zeitstempel des Verlassens
     */
    async closeSession(deviceKey, endTime) {
        const session = this.activeSessions[deviceKey];
        if (!session) return;
        const employee = this.employees[deviceKey];
        const startTime = session.startTime;
        const durationMs = endTime - startTime;
        const durationHours = durationMs / (1000 * 60 * 60);
        const customerKey = session.customer;
        const customer = this.customers[customerKey] || { name: customerKey, hourlyRate: 0 };

        // Erstelle einen Logeintrag für diesen Arbeitseinsatz
        const logEntry = {
            employee: `${employee.firstName} ${employee.lastName}`,
            customer: customer.name,
            address: customer.address || '',
            hourlyRate: customer.hourlyRate,
            startTime: new Date(startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
            durationHours: durationHours,
            workDescription: session.workDescription  // Kann über eine UI später ergänzt werden
        };

        // Beispiel: Speichere den Logeintrag in einem neuen State (alternativ auch in einer Datenbank o.ä.)
        const logStateId = `workLog.${Date.now()}`;
        await this.setObjectNotExistsAsync(logStateId, {
            type: 'state',
            common: {
                name: 'Work Log Entry',
                type: 'string',
                role: 'value.text',
                read: true,
                write: false
            },
            native: {}
        });
        await this.setStateAsync(logStateId, { val: JSON.stringify(logEntry), ack: true });
        this.log.info(`Arbeitseinsatz protokolliert: ${JSON.stringify(logEntry)}`);

        // Entferne die aktive Sitzung
        delete this.activeSessions[deviceKey];

        // Hier kannst du auch Aggregationen aktualisieren (z.B. Stunden pro Tag, Woche, Monat, Jahr)
        await this.updateAggregates(employee, logEntry);
    }

    /**
     * Aktualisiert aggregierte Arbeitszeiten (Tages-, Wochen-, Monats-, Jahreswerte).
     * Hier ist eine Platzhalterfunktion – die eigentliche Implementierung hängt von deinen Anforderungen ab.
     */
    async updateAggregates(employee, logEntry) {
        this.log.info(`Aktualisiere Aggregatwerte für ${employee.firstName} ${employee.lastName} mit ${logEntry.durationHours.toFixed(2)} Stunden.`);
        // Hier: Vorhandene Aggregatwerte abrufen, addieren und aktualisieren.
    }
}

if (module.parent) {
    module.exports = (options) => new WorkTimeAdapter(options);
} else {
    new WorkTimeAdapter();
}
