const axios = require("axios");

/**
 * Cliente para la API de MiCorreo (Correo Argentino).
 * Maneja la obtención y el cacheo del JWT token, y expone
 * un método para cotizar envíos.
 */
class MiCorreoClient {
  constructor({ baseUrl, user, password, customerId }) {
    if (!baseUrl || !user || !password || !customerId) {
      throw new Error(
        "MiCorreo: faltan credenciales (MICORREO_BASE_URL / MICORREO_USER / MICORREO_PASSWORD / MICORREO_CUSTOMER_ID)",
      );
    }
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.user = user;
    this.password = password;
    this.customerId = customerId;

    this._token = null;
    this._tokenExpiresAt = null;

    this.http = axios.create({ baseURL: this.baseUrl, timeout: 8000 });
  }

  async _getToken() {
    const now = Date.now();
    if (this._token && this._tokenExpiresAt && now < this._tokenExpiresAt - 60_000) {
      return this._token;
    }

    const response = await this.http.post("/token", null, {
      auth: { username: this.user, password: this.password },
    });

    const { token, expires } = response.data;
    this._token = token;
    this._tokenExpiresAt = new Date(expires.replace(" ", "T")).getTime();

    return this._token;
  }

  async _authHeader() {
    const token = await this._getToken();
    return { Authorization: `Bearer ${token}` };
  }

  /**
   * @param {Object} params
   * @param {string} params.postalCodeOrigin
   * @param {string} params.postalCodeDestination
   * @param {'D'|'S'} [params.deliveredType]
   * @param {Object} params.dimensions - { weight (g), height (cm), width (cm), length (cm) }
   */
  async getRates({ postalCodeOrigin, postalCodeDestination, deliveredType, dimensions }) {
    const headers = await this._authHeader();

    const body = {
      customerId: this.customerId,
      postalCodeOrigin,
      postalCodeDestination,
      dimensions,
    };
    if (deliveredType) body.deliveredType = deliveredType;

    const response = await this.http.post("/rates", body, { headers });
    return response.data;
  }
}

module.exports = MiCorreoClient;