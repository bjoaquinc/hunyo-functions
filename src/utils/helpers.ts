import { Timestamp } from 'firebase-admin/firestore';
import { DateTime } from 'luxon';

export const getFormLink = (formId: string) => {
  let FORM_LINK;
  const DEV_URL = 'http://localhost:8080';
  const PROD_URL = 'https://hunyo.design';

  if (process.env.FUNCTIONS_EMULATOR) {
    FORM_LINK = `${DEV_URL}/applicant/forms/${formId}`;
  } else {
    FORM_LINK = `${PROD_URL}/applicant/forms/${formId}`;
  }
  return FORM_LINK;
};

export const getFormattedDate = (date: Timestamp) => {
  const dateMillis = date.toMillis();
  const dateTime = DateTime.fromMillis(dateMillis);
  const formattedDate = dateTime.toLocaleString({
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  });
  return formattedDate;
};
