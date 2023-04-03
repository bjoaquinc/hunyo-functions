const getFullPath = (...ids: string[]) => {
  let fullPath = '';
  for (const id of ids) {
    fullPath += fullPath ? `/${id}` : id;
  }
  return fullPath;
};

export const storagePaths = {
  getLogoPath: (logoName: string) => getFullPath('logos', logoName),
  getNewSamplePath: (
    companyId: string,
    dashboardId: string,
    sampleName: string
  ) =>
    getFullPath(
      'companies',
      companyId,
      'dashboards',
      dashboardId,
      'new-samples',
      sampleName
    ),
  getSamplePath: (companyId: string, dashboardId: string, sampleName: string) =>
    getFullPath(
      'companies',
      companyId,
      'dashboards',
      dashboardId,
      'samples',
      sampleName
    ),
  getTemporaryDocsPath: (docName: string) =>
    getFullPath('temporary-docs', docName),
  getFixedDocPath: (
    companyId: string,
    dashboardId: string,
    applicantId: string,
    docName: string
  ) =>
    getFullPath(
      'companies',
      companyId,
      'dashboards',
      dashboardId,
      'fixed',
      applicantId,
      docName
    ),
  getOriginalDocPath: (
    companyId: string,
    dashboardId: string,
    applicantId: string,
    docName: string
  ) =>
    getFullPath(
      'companies',
      companyId,
      'dashboards',
      dashboardId,
      'originals',
      applicantId,
      docName
    ),
  getFinalDocPath: (
    companyId: string,
    dashboardId: string,
    applicantId: string,
    updatedName: string
  ) =>
    getFullPath(
      'companies',
      companyId,
      'dashboards',
      dashboardId,
      'final',
      applicantId,
      updatedName
    ),
  getReplacedDocPath: (
    companyId: string,
    dashboardId: string,
    applicantId: string,
    docName: string
  ) =>
    getFullPath(
      'companies',
      companyId,
      'dashboards',
      dashboardId,
      'replaced',
      applicantId,
      docName
    ),
};
