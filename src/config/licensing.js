/** Regex oficial do código de licença */
const LICENSE_CODE_REGEX = /^takahashi-store-[A-Za-z0-9]{7,12}$/;

const LICENSE_PREFIX = 'takahashi-store-';

const DURATION_DAYS = {
  MONTH_1: 30,
  MONTH_3: 90,
  YEAR_1: 365
};

const DURATION_LABELS = {
  MONTH_1: '1 mês',
  MONTH_3: '3 meses',
  YEAR_1: '1 ano'
};

/** ID fixo do tenant da rede Takahashi (dados legados) */
const PLATFORM_TENANT_ID = 'platform';

module.exports = {
  LICENSE_CODE_REGEX,
  LICENSE_PREFIX,
  DURATION_DAYS,
  DURATION_LABELS,
  PLATFORM_TENANT_ID
};
