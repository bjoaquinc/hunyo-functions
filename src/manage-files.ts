import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import axios from 'axios';
const bucket = admin.storage().bucket();
import FormData from 'form-data';
import { updateForm } from './forms';
type ContentTypes = 'jpeg' | 'pdf';
const NEW_IMAGE_WIDTH = 1240;

export const onFileUpload = functions
  .region('asia-southeast2')
  .runWith({
    timeoutSeconds: 400,
    memory: '1GB',
    secrets: ['SITE_ENGINE_API_SECRET', 'SITE_ENGINE_API_USER'],
  })
  .storage.object()
  .onFinalize(async (object, context) => {
    const filePath = object.name as string;
    const contentType = object.contentType as string;
    const metadata = object.metadata as {
      companyId: string;
      dashboardId: string;
      applicantId: string;
      docId: string;
      pageId: string;
      formId: string;
      format: ContentTypes;
      submissionCount: string;
    };

    if (!filePath.includes('temporary-docs/')) {
      return functions.logger.log('Document is not an applicant doc');
    }

    if (!contentType.startsWith('image/')) {
      return functions.logger.log('This is not an image');
    }

    const {
      companyId,
      dashboardId,
      applicantId,
      formId,
      docId,
      pageId,
      format,
      submissionCount,
    } = metadata;
    const readableStream = getReadableStream(filePath);
    const resizedImage = await readableStream.pipe(toJPEG('resize')).toBuffer();
    const imageProperties = await getImageProperties(resizedImage, filePath);
    const fileName = filePath.split('/').pop() as string;
    const originalFilePath = getNewFilePath(
      'companies',
      companyId,
      'dashboards',
      dashboardId,
      'originals',
      applicantId,
      fileName + `.jpeg`
    );
    const fixedFilePath = getNewFilePath(
      'companies',
      companyId,
      'dashboards',
      dashboardId,
      'fixed',
      applicantId,
      fileName + `.${format}`
    );
    const promises: Promise<void | {
      brightness: number;
      sharpness: number;
      contrast: number;
    }>[] = [];

    promises.push(manageFixedFile(fileName, filePath, fixedFilePath, format));
    promises.push(
      manageOriginalFile(
        resizedImage,
        originalFilePath,
        fileName,
        'jpeg',
        imageProperties
      )
    );
    const results = await Promise.all(promises);
    await bucket.file(filePath).delete();
    const fixedImageProperties = results[0];
    if (fixedImageProperties) {
      const systemCheckStatus = acceptOrRejectImageQuality(
        fixedImageProperties,
        parseInt(submissionCount)
      );
      await updatePageSystemCheck(formId, docId, pageId, systemCheckStatus);
    }

    return functions.logger.log('Successfully processed image');
  });

const manageFixedFile = async (
  fileName: string,
  filePath: string,
  newFilePath: string,
  format: ContentTypes
) => {
  const readableStream = getReadableStream(filePath);
  const imageBuffer = await readableStream
    .pipe(toJPEG('resize'))
    .pipe(toJPEG('fix'))
    .toBuffer();
  const imageProperties = await getImageProperties(imageBuffer, filePath);
  const writableStream = getWritableStream(newFilePath, {
    contentType: getContentType(format),
    contentDisposition: `inline; filename=${fileName}-fixed.${format}`,
    metadata: {
      ...imageProperties,
    },
  });

  if (format === 'jpeg') {
    sharp(imageBuffer).pipe(writableStream);
  }
  if (format === 'pdf') {
    const imageMetadata = await sharp(imageBuffer).metadata();
    const width = imageMetadata.width;
    const height = imageMetadata.height;

    if (!width || !height) return;

    toPDF(imageBuffer, {
      width,
      height,
    }).pipe(writableStream);
  }

  await new Promise((resolve, reject) => {
    writableStream.on('finish', resolve).on('error', reject);
  });

  return imageProperties;
};

const manageOriginalFile = async (
  image: Buffer,
  newFilePath: string,
  fileName: string,
  format: ContentTypes,
  imageProperties?: FilteredImageProperties
) => {
  const writableStream = getWritableStream(newFilePath, {
    contentType: getContentType(format),
    contentDisposition: `inline; filename=${fileName}-fixed.${format}`,
    metadata: {
      ...imageProperties,
    },
  });

  sharp(image).pipe(writableStream);

  await new Promise((resolve, reject) => {
    writableStream.on('finish', resolve).on('error', reject);
  });
};

const getContentType = (format: ContentTypes) => {
  const newContentType = {
    jpeg: 'image/jpeg',
    pdf: 'application/pdf',
  };
  return newContentType[format];
};

const getNewFilePath = (...keys: string[]) => {
  let filePath = '';
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      filePath += key;
    } else {
      filePath += key + '/';
    }
  });
  return filePath;
};

const acceptOrRejectImageQuality = (
  imageProperties: {
    brightness: number;
    sharpness: number;
    contrast: number;
  },
  submissionCount: number
): 'Accepted' | 'Rejected' => {
  const MINIMUM_VIABLE_SHARPNESS = 0.9;
  const MINIMUM_VIABLE_BRIGHTNESS = 0.3;
  const MINIMUM_VIABLE_CONTRAST = 0.75;
  const MAXIMUM_REJECTION_COUNT = 3;
  const { brightness, sharpness, contrast } = imageProperties;
  const imagePassesQualityCheck =
    brightness > MINIMUM_VIABLE_BRIGHTNESS &&
    sharpness > MINIMUM_VIABLE_SHARPNESS &&
    contrast > MINIMUM_VIABLE_CONTRAST;
  const overRejectedLimit = submissionCount > MAXIMUM_REJECTION_COUNT;
  let IMAGE_CHECK_STATUS: 'Accepted' | 'Rejected' | '' = '';

  if (imagePassesQualityCheck || overRejectedLimit) {
    IMAGE_CHECK_STATUS = 'Accepted';
  } else {
    IMAGE_CHECK_STATUS = 'Rejected';
  }

  return IMAGE_CHECK_STATUS;
};

const updatePageSystemCheck = async (
  formId: string,
  docId: string,
  pageId: string,
  systemCheckStatus: 'Accepted' | 'Rejected'
) => {
  await updateForm(formId, {
    [`docs.${docId}.pages.${pageId}.systemCheckStatus`]: systemCheckStatus,
  });
};

const getReadableStream = (filePath: string) => {
  const file = bucket.file(filePath);
  const readableStream = file.createReadStream();
  return readableStream;
};

const getWritableStream = (
  filePath: string,
  metadata: {
    contentType: string;
    contentDisposition: string;
    metadata: {
      brightness?: number;
      sharpness?: number;
      contrast?: number;
    };
  }
) => {
  const writableStream = bucket.file(filePath).createWriteStream({
    metadata,
  });
  return writableStream;
};

const getImageProperties = async (image: Buffer, imagePath: string) => {
  try {
    const data = new FormData();
    data.append('media', image, {
      filename: imagePath,
    });
    data.append('models', 'properties');
    data.append('api_user', process.env.SITE_ENGINE_API_USER);
    data.append('api_secret', process.env.SITE_ENGINE_API_SECRET);

    const response = await axios({
      method: 'post',
      url: 'https://api.sightengine.com/1.0/check.json',
      data,
      headers: data.getHeaders(),
    });
    if (response) {
      const { sharpness, brightness, contrast } =
        response.data as ImageProperties;
      return {
        sharpness,
        brightness,
        contrast,
      };
    } else {
      return;
    }
  } catch (error) {
    functions.logger.log(error);
    return;
  }
};

const toJPEG = (task: 'resize' | 'fix') => {
  const pipeline = sharp();
  const BRIGHTNESS_ADJUSTMENT = 1.2;
  if (task === 'resize') {
    return pipeline
      .withMetadata() // Keep original metadata of image
      .rotate() // Fix image orientation based on image EXIF data
      .resize(NEW_IMAGE_WIDTH)
      .jpeg({ mozjpeg: true });
  } else {
    return pipeline
      .removeAlpha()
      .flatten()
      .sharpen()
      .modulate({
        brightness: BRIGHTNESS_ADJUSTMENT,
      })
      .normalise();
  }
};

const toPDF = (
  image: Buffer,
  dimensions: {
    width: number;
    height: number;
  }
) => {
  const doc = new PDFDocument();
  doc.page.size = 'A4';
  doc.page.layout = 'fit';

  const imageAspecRatio = dimensions.height / dimensions.width;
  let imageWidth = doc.page.width;
  let imageHeight = imageWidth * imageAspecRatio;

  if (imageHeight > doc.page.height) {
    imageHeight = doc.page.height;
    imageWidth = imageHeight / imageAspecRatio;
  }

  doc.image(image, 0, 0, {
    fit: [doc.page.width, doc.page.height],
    align: 'center',
    valign: 'center',
    width: imageWidth,
    height: imageHeight,
  });
  doc.end();
  return doc;
};

interface FilteredImageProperties {
  brightness: number;
  sharpness: number;
  contrast: number;
}

interface ImageProperties {
  status: 'success';
  request: {
    id: string;
    timestamp: number;
    operations: number;
  };
  sharpness: number;
  brightness: number;
  contrast: number;
  colors: {
    dominant: {
      r: number;
      g: number;
      b: number;
      hex: string;
      hsv: number[];
    };
    accent: [
      {
        r: number;
        g: number;
        b: number;
        hex: string;
        hsv: number[];
      },
      {
        r: number;
        g: number;
        b: number;
        hex: string;
        hsv: number[];
      }
    ];
    other: [
      {
        r: number;
        g: number;
        b: number;
        hex: string;
        hsv: number[];
      },
      {
        r: number;
        g: number;
        b: number;
        hex: string;
        hsv: number[];
      },
      {
        r: number;
        g: number;
        b: number;
        hex: string;
        hsv: number[];
      },
      {
        r: number;
        g: number;
        b: number;
        hex: string;
        hsv: number[];
      }
    ];
  };
  media: {
    id: string;
    uri: string;
  };
}
