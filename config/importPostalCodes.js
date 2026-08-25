const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const mongoose = require("mongoose");

const PostalCode = require("../models/postalCode.model");

const MONGO_URI = process.env.MONGO_URI;

const filePath = path.join(
  __dirname,
  "../data/localidades_cp_maestro.csv"
);

async function importPostalCodes() {
  try {
    await mongoose.connect(MONGO_URI);

    console.log("MongoDB conectado");

    const records = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        /**
         * ACÁ VAMOS A ADAPTAR
         * las columnas del CSV original.
         */

        const postalCode = String(
          row.cp ||
          row.CP ||
          row.codigo_postal ||
          row.postalCode ||
          ""
        ).trim();

        const city = String(
          row.localidad ||
          row.Localidad ||
          row.city ||
          ""
        ).trim();

        const province = String(
          row.provincia ||
          row.Provincia ||
          ""
        ).trim();

        if (!postalCode || !city || !province) {
          return;
        }

        let zone = "RESTO";

        if (
          province
            .toLowerCase()
            .includes("buenos aires")
        ) {
          zone = "BUENOS_AIRES";
        }

        if (
          province
            .toLowerCase()
            .includes("capital federal") ||
          province
            .toLowerCase()
            .includes("caba")
        ) {
          zone = "CABA";
        }

        records.push({
          postalCode,
          city,
          province,
          zone,
        });
      })

      .on("end", async () => {
        console.log(
          `Registros encontrados: ${records.length}`
        );

        if (!records.length) {
          console.log(
            "No se encontraron registros."
          );

          await mongoose.disconnect();
          return;
        }

        await PostalCode.deleteMany({});

        await PostalCode.insertMany(records, {
          ordered: false,
        });

        console.log(
          `Importados ${records.length} códigos postales`
        );

        await mongoose.disconnect();
      });
  } catch (error) {
    console.error(
      "Error importando códigos postales:",
      error
    );

    await mongoose.disconnect();
    process.exit(1);
  }
}

importPostalCodes();