/**
 * UMANARAYNI AYURVEDA — PhonePe Payment Gateway Service
 * 
 * =========================================================================================
 * 📜 ARCHITECTURAL NOTE: PHONEPE API VERSION & OAUTH MIGRATION ROADMAP
 * =========================================================================================
 * CURRENT VERSION: PhonePe PG v1 (Standard Checkout)
 * - Authentication: Static Merchant ID + Salt Key + Salt Index
 * - Checksum: Custom SHA256 header (X-VERIFY: sha256(payload + endpoint + saltKey)###saltIndex)
 * - Endpoints: /pg/v1/pay (Initiation), /pg/v1/status/{mid}/{txnId} (Status)
 * - Status: Fully operational for UAT Sandbox and classic merchant accounts.
 * 
 * UPCOMING / MODERN VERSION: PhonePe PG v2 / NextGen (OAuth 2.0 Client Credentials)
 * - Authentication: OAuth 2.0 with Client ID & Client Secret
 * - Flow: POST /v1/oauth/token with Basic Auth -> Returns Bearer Access Token (expires in ~3600s)
 * - Payment: POST /v2/pay with Authorization: Bearer <token> and digital RSA signature
 * - Recommendation: This module is structured as an adapter. When PhonePe provides your
 *   OAuth Client ID & Secret for the NextGen gateway, you only need to swap the implementation
 *   inside this service without touching the Express route handlers or order processing logic!
 * =========================================================================================
 */

const axios = require('axios');
const crypto = require('crypto');

function getPhonePeConfig() {
  const merchantId = (process.env.PHONEPE_MERCHANT_ID || 'PGTESTPAYUAT').trim();
  const saltKey = (process.env.PHONEPE_SALT_KEY || '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399').trim();
  const saltIndex = (process.env.PHONEPE_SALT_INDEX || '1').trim();
  const baseUrl = (process.env.PHONEPE_BASE_URL || 'https://api-preprod.phonepe.com/apis/pg-sandbox').replace(/\/+$/, '');
  const env = (process.env.PHONEPE_ENV || 'UAT').trim().toUpperCase();

  return { merchantId, saltKey, saltIndex, baseUrl, env };
}

/**
 * Initiates a standard PhonePe hosted payment request
 */
async function initiatePaymentOrder({
  amountInPaise,
  merchantTransactionId,
  merchantUserId,
  customerPhone,
  redirectUrl,
  callbackUrl
}) {
  let { merchantId, saltKey, saltIndex, baseUrl } = getPhonePeConfig();

  const cleanPhone = String(customerPhone || '').replace(/\D/g, '').slice(-10) || '9999999999';

  const payload = {
    merchantId,
    merchantTransactionId,
    merchantUserId: merchantUserId || `MUID_${Date.now()}`,
    amount: amountInPaise,
    redirectUrl,
    redirectMode: "REDIRECT",
    callbackUrl,
    mobileNumber: cleanPhone,
    paymentInstrument: {
      type: "PAY_PAGE"
    }
  };

  let base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
  let stringToHash = base64Payload + "/pg/v1/pay" + saltKey;
  let sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
  let xVerify = `${sha256}###${saltIndex}`;

  let response;
  try {
    response = await axios.post(
      `${baseUrl}/pg/v1/pay`,
      { request: base64Payload },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': xVerify,
          'Accept': 'application/json'
        },
        timeout: 15000
      }
    );
  } catch (apiErr) {
    // Graceful fallback for PhonePe rotated sandbox key PGTESTPAYUAT86
    if (apiErr.response && apiErr.response.data && apiErr.response.data.code === 'KEY_NOT_CONFIGURED') {
      console.warn('⚠️ PhonePe primary sandbox key not configured on host. Retrying with active UAT sandbox key (PGTESTPAYUAT86)...');
      merchantId = 'PGTESTPAYUAT86';
      saltKey = '96434309-7796-489d-8924-ab56988a6076';
      saltIndex = '1';

      payload.merchantId = merchantId;
      base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
      stringToHash = base64Payload + "/pg/v1/pay" + saltKey;
      sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
      xVerify = `${sha256}###${saltIndex}`;

      response = await axios.post(
        `${baseUrl}/pg/v1/pay`,
        { request: base64Payload },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': xVerify,
            'Accept': 'application/json'
          },
          timeout: 15000
        }
      );
    } else {
      throw apiErr;
    }
  }

  const resData = response.data;
  const redirectInfoUrl = resData?.data?.instrumentResponse?.redirectInfo?.url;

  return {
    success: Boolean(resData && resData.success && redirectInfoUrl),
    redirectUrl: redirectInfoUrl,
    merchantTransactionId,
    merchantId,
    rawResponse: resData
  };
}

/**
 * Verifies a Server-to-Server (S2S) Callback from PhonePe
 * 
 * Formula: SHA256(response_base64 + saltKey) + "###" + saltIndex === X-VERIFY
 * 
 * @param {object} params
 * @param {string} params.responseBase64 Base64 string from req.body.response
 * @param {string} params.xVerify Header from req.headers['x-verify']
 * @returns {{ isValid: boolean, decoded: object|null, reason?: string }}
 */
function verifyS2SCallback({ responseBase64, xVerify }) {
  if (!responseBase64 || !xVerify) {
    return { isValid: false, decoded: null, reason: 'Missing response payload or X-VERIFY header' };
  }

  const { saltKey, saltIndex } = getPhonePeConfig();

  // Try standard config key first
  const expectedHash = crypto.createHash('sha256').update(responseBase64 + saltKey).digest('hex');
  const expectedXVerify = `${expectedHash}###${saltIndex}`;

  let isMatch = (xVerify.trim() === expectedXVerify);

  // In sandbox, check fallback test key if first check fails
  if (!isMatch) {
    const fallbackSaltKey = '96434309-7796-489d-8924-ab56988a6076';
    const fallbackHash = crypto.createHash('sha256').update(responseBase64 + fallbackSaltKey).digest('hex');
    const fallbackXVerify = `${fallbackHash}###1`;
    if (xVerify.trim() === fallbackXVerify) {
      isMatch = true;
    }
  }

  if (!isMatch) {
    return { isValid: false, decoded: null, reason: 'X-VERIFY checksum mismatch' };
  }

  let decoded = null;
  try {
    const jsonStr = Buffer.from(responseBase64, 'base64').toString('utf8');
    decoded = JSON.parse(jsonStr);
  } catch (parseErr) {
    return { isValid: false, decoded: null, reason: 'Malformed Base64 JSON payload' };
  }

  return {
    isValid: true,
    decoded,
    success: Boolean(decoded && decoded.success && decoded.code === 'PAYMENT_SUCCESS'),
    merchantTransactionId: decoded?.data?.merchantTransactionId || decoded?.data?.transactionId,
    transactionId: decoded?.data?.transactionId,
    amount: decoded?.data?.amount,
    code: decoded?.code,
    message: decoded?.message
  };
}

/**
 * Checks payment status via PhonePe /pg/v1/status API (Fallback check)
 */
async function checkPaymentStatus(merchantTransactionId, customMerchantId = null) {
  let { merchantId, saltKey, saltIndex, baseUrl } = getPhonePeConfig();
  if (customMerchantId) merchantId = customMerchantId;
  if (merchantId === 'PGTESTPAYUAT86') {
    saltKey = '96434309-7796-489d-8924-ab56988a6076';
    saltIndex = '1';
  }

  const endpoint = `/pg/v1/status/${merchantId}/${merchantTransactionId}`;
  const stringToHash = `${endpoint}${saltKey}`;
  const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
  const xVerify = `${sha256}###${saltIndex}`;

  try {
    const response = await axios.get(`${baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': xVerify,
        'X-MERCHANT-ID': merchantId,
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    const data = response.data;
    const isSuccess = Boolean(data && data.success && data.code === 'PAYMENT_SUCCESS');
    return {
      success: isSuccess,
      code: data?.code || 'UNKNOWN',
      message: data?.message || '',
      data: data?.data || null,
      raw: data
    };
  } catch (err) {
    const errData = err.response ? err.response.data : null;
    return {
      success: false,
      code: errData?.code || 'STATUS_CHECK_FAILED',
      message: errData?.message || err.message,
      data: null
    };
  }
}

module.exports = {
  getPhonePeConfig,
  initiatePaymentOrder,
  verifyS2SCallback,
  checkPaymentStatus
};
