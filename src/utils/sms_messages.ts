export const getDocumentsRequestMessage = (
  applicantName: string,
  companyName: string,
  applicantURL: string
) => {
  const message = `Hi ${applicantName}, this is ${
    companyName + (companyName.endsWith('.') ? '' : '.')
    // eslint-disable-next-line max-len
  } Please click on this link to submit your documentary requirements: ${applicantURL}`;
  return message;
};
