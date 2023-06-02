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

export const deepEquals = (
  obj1: { [key: string]: unknown } | undefined,
  obj2: { [key: string]: unknown } | undefined
) => {
  if (obj1 === obj2) return true;
  if (!obj1 || !obj2) return false;
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;
  for (const key of keys1) {
    const val1 = obj1[key];
    const val2 = obj2[key];
    const areObjects = typeof val1 === 'object' && typeof val2 === 'object';
    if (
      (areObjects &&
        !deepEquals(
          val1 as { [key: string]: unknown },
          val2 as { [key: string]: unknown }
        )) ||
      (!areObjects && val1 !== val2)
    ) {
      return false;
    }
  }
  return true;
};

export const getUpdatedDocName = (
  docName: string,
  applicantName: {
    first: string;
    middle: string;
    last: string;
  }
) => {
  const applicantNameCopy = { ...applicantName };
  Object.keys(applicantNameCopy).forEach((key) => {
    const typedKey = key as keyof typeof applicantNameCopy;
    applicantNameCopy[typedKey] = fixName(applicantNameCopy[typedKey]);
  });
  const { first, middle, last } = applicantNameCopy;
  const updatedName = `${first}_${middle}_${last}`;
  const cleanedDocName = docName.trim();
  return cleanedDocName + '_' + updatedName + '.pdf';
};

const fixName = (name: string) => {
  const fixedName = name
    .trim()
    .split(' ')
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join('_');
  return fixedName;
};
