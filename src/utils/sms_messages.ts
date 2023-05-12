export const getDocumentsRequestMessage = (
  applicantName: string,
  companyName: string,
  applicantURL: string
) => {
  // eslint-disable-next-line max-len
  const message = `Hi ${applicantName}, this is ${companyName}. Please click on this link to submit your documentary requirements: ${applicantURL}`;
  return message;
};
