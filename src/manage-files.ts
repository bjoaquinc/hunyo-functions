import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import axios from 'axios';
const bucket = admin.storage().bucket();
import FormData from 'form-data';
import {
  ApplicantPage,
  ApplicantPageImageProperties,
} from '../../src/utils/new-types';
import { storagePaths } from './utils/storage';
import { dbDocRefs } from './utils/db';
type ContentTypes = 'jpeg' | 'pdf';
const NEW_IMAGE_WIDTH = 1240;

export const updateImageProperties = functions
  .region('asia-southeast2')
  .firestore.document('companies/{companyId}/pages/{pageId}')
  .onUpdate(async (change, context) => {
    const prevPage = change.before.data() as ApplicantPage;
    const newPage = change.after.data() as ApplicantPage;
    const pageId = context.params.pageId;
    if (
      newPage.updatingFixedImage &&
      !prevPage.updatingFixedImage &&
      newPage.imageProperties
    ) {
      const { companyId, dashboardId, applicantId, name } = newPage;
      const IMAGE_SUFFIX = '.jpeg';
      const filePath = storagePaths.getOriginalDocPath(
        companyId,
        dashboardId,
        applicantId,
        `${name}${IMAGE_SUFFIX}`
      );
      const [file] = await bucket.file(filePath).download();
      const pipeline = fixImagePipeline(newPage.imageProperties, file);
      const fixedImage = await pipeline.toBuffer();
      const { height, width } = await sharp(fixedImage).metadata();
      if (!width || !height) return functions.logger.log('No width or height');
      const fixedPDF = toPDF(fixedImage, { width, height });
      const FIXED_IMAGE_SUFFIX = '.pdf';
      const fixedImagePath = storagePaths.getFixedDocPath(
        companyId,
        dashboardId,
        applicantId,
        `${name}${FIXED_IMAGE_SUFFIX}`
      );
      const writableStream = getWritableStream(fixedImagePath, {
        contentType: 'application/pdf',
        contentDisposition: `inline filename="fixed.pdf"`,
      });
      fixedPDF.pipe(writableStream);
      await new Promise((resolve, reject) => {
        writableStream.on('finish', resolve);
        writableStream.on('error', reject);
      });
      const pageRef = dbDocRefs.getPageRef(companyId, pageId);
      await pageRef.update({
        updatingFixedImage: false,
      });
      return;
    } else {
      return functions.logger.log('No updated image properties');
    }
  });

const fixImagePipeline = (
  imageProperties: ApplicantPageImageProperties,
  file?: Buffer
) => {
  let pipeline;
  if (file) {
    pipeline = sharp(file);
  } else {
    pipeline = sharp();
  }
  const { brightness, sharpness, contrast, rotateRight, normalise } =
    imageProperties;
  if (brightness !== undefined) {
    pipeline.modulate({ brightness: parseFloat(brightness) });
  }
  if (sharpness !== undefined) {
    const SHARPNESS_NUMBER = parseFloat(sharpness);
    if (SHARPNESS_NUMBER === 0) {
      pipeline.sharpen();
    } else {
      pipeline.sharpen(SHARPNESS_NUMBER);
    }
  }
  if (contrast !== undefined) {
    const CONTRAST_NUMBER = parseFloat(contrast);
    // got the contrast formula from https://github.com/lovell/sharp/issues/1958
    const CONTRAST_LINEAR_EQUATION = -(128 * CONTRAST_NUMBER) + 128;
    pipeline.linear(CONTRAST_NUMBER, CONTRAST_LINEAR_EQUATION);
  }

  if (rotateRight !== undefined) {
    pipeline.rotate(parseInt(rotateRight));
  }

  if (normalise) {
    pipeline.normalize();
  }

  return pipeline;
};

export const onImagePropertyUpdated = functions
  .region('asia-southeast2')
  .runWith({
    timeoutSeconds: 400,
    memory: '1GB',
    secrets: ['SITE_ENGINE_API_SECRET', 'SITE_ENGINE_API_USER'],
  })
  .storage.object()
  .onMetadataUpdate(async (object, context) => {
    const metadata = object.metadata as {
      property: 'removeBrightness';
      format: 'jpeg' | 'pdf';
      companyId: string;
      dashboardId: string;
      applicantId: string;
    };
    const filePath = object.name as string;
    const fileName = filePath.split('/').pop() as string;
    const newFileName = fileName.split('.')[0] + `.${metadata.format}`;
    functions.logger.log('metadata', metadata, 'filePath', filePath);
    if (metadata && metadata.property === 'removeBrightness') {
      const { companyId, dashboardId, applicantId } = metadata;
      const readableStream = getReadableStream(filePath);
      const newFilePath = getNewFilePath(
        'companies',
        companyId,
        'dashboards',
        dashboardId,
        'fixed',
        applicantId,
        newFileName
      );

      const buffer = await readableStream
        .pipe(
          toJPEG('fix', {
            removeBrightness: true,
          })
        )
        .toBuffer();
      const imageProperties = await getImageProperties(buffer, filePath);

      const writableStream = getWritableStream(newFilePath, {
        contentType:
          metadata.format === 'pdf' ? 'application/pdf' : 'image/jpeg',
        contentDisposition: 'inline',
        metadata: {
          ...imageProperties,
        },
      });

      if (metadata.format === 'pdf') {
        const imageMetadata = await sharp(buffer).metadata();
        const width = imageMetadata.width;
        const height = imageMetadata.height;

        if (!width || !height) return;

        toPDF(buffer, {
          width,
          height,
        }).pipe(writableStream);

        await new Promise((resolve, reject) => {
          writableStream.on('finish', resolve).on('error', reject);
        });
        functions.logger.log('Successfully updated image property');
      }
    }
  });

export const onImageStatusUpdated = functions
  .region('asia-southeast2')
  .runWith({
    timeoutSeconds: 400,
    memory: '1GB',
  })
  .storage.object()
  .onMetadataUpdate(async (object, context) => {
    const metadata = object.metadata as {
      status: 'accepted' | 'rejected';
      updatedName: string;
      companyId: string;
      dashboardId: string;
      applicantId: string;
    };
    const filePath = object.name as string;
    if (metadata && metadata.status === 'accepted') {
      const { companyId, dashboardId, applicantId, updatedName } = metadata;
      const contentType = object.contentType as string;
      const readableStream = getReadableStream(filePath);
      const newFilePath = getNewFilePath(
        'companies',
        companyId,
        'dashboards',
        dashboardId,
        'accepted',
        applicantId,
        updatedName
      );
      const writableStream = getWritableStream(newFilePath, {
        contentType,
      });

      readableStream.pipe(writableStream);

      await new Promise((resolve, reject) => {
        writableStream.on('finish', resolve).on('error', reject);
      });
      functions.logger.log('Successfully moved file to accepted folder');
    }

    if (metadata && metadata.status === 'rejected') {
      const { companyId, dashboardId, applicantId, updatedName } = metadata;
      const contentType = object.contentType as string;
      const readableStream = getReadableStream(filePath);
      const newFilePath = getNewFilePath(
        'companies',
        companyId,
        'dashboards',
        dashboardId,
        'rejected',
        applicantId,
        updatedName
      );
      const writableStream = getWritableStream(newFilePath, {
        contentType,
      });

      readableStream.pipe(writableStream);

      await new Promise((resolve, reject) => {
        writableStream.on('finish', resolve).on('error', reject);
      });
      functions.logger.log('Successfully moved file to rejected folder');
    }
  });

export const onSampleUpload = functions
  .region('asia-southeast2')
  .runWith({
    timeoutSeconds: 400,
    memory: '1GB',
  })
  .storage.object()
  .onFinalize(async (object, context) => {
    const filePath = object.name as string;
    const contentType = object.contentType as string;

    if (!filePath.includes('new-samples/')) {
      return functions.logger.log('Document is not a new sample');
    }

    const readableStream = getReadableStream(filePath);
    const fileName = filePath.split('/').pop() as string;
    const newFilePath = filePath.replace('new-samples', 'samples');

    if (contentType.startsWith('image/')) {
      // process image
      const writableStream = getWritableStream(newFilePath, {
        contentType: 'image/jpeg',
        contentDisposition: `inline; filename=${fileName}.jpeg`,
      });
      const pipeline = toJPEG('resize');
      readableStream.pipe(pipeline).pipe(writableStream);
      await new Promise((resolve, reject) => {
        writableStream.on('finish', resolve).on('error', reject);
      });
      await bucket.file(filePath).delete();
    }

    if (contentType === 'application/pdf') {
      // process pdf
      const writableStream = getWritableStream(newFilePath, {
        contentType: 'application/pdf',
        contentDisposition: `inline; filename=${fileName}.pdf`,
      });
      readableStream.pipe(writableStream);
      await new Promise((resolve, reject) => {
        writableStream.on('finish', resolve).on('error', reject);
      });
      await bucket.file(filePath).delete();
    }
    return;
  });

export const onPDFUpload = functions
  .region('asia-southeast2')
  .runWith({
    timeoutSeconds: 400,
    memory: '1GB',
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
      formId: string;
      format: ContentTypes;
      submissionCount: string;
    };

    if (
      contentType === 'application/pdf' &&
      filePath.includes('temporary-docs/')
    ) {
      // if file is pdf in temporary-docs folder
      // eslint-disable-next-line max-len
      const fileName = filePath.split('/').pop() as string;
      // eslint-disable-next-line max-len
      const newFilePath = `companies/${metadata.companyId}/dashboards/${metadata.dashboardId}/originals/${metadata.applicantId}/${fileName}.pdf`;
      const readableStream = getReadableStream(filePath);
      const writableStream = getWritableStream(newFilePath, {
        contentType,
        contentDisposition: `inline; filename=${fileName}.pdf`,
      });

      readableStream.pipe(writableStream);

      await new Promise((resolve, reject) => {
        writableStream.on('finish', resolve).on('error', reject);
      });

      await bucket.file(filePath).delete();
    }
  });

export const onImageUpload = functions
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
      formId: string;
      format: ContentTypes;
      submissionCount: string;
      angle?: '0' | '90' | '180' | '270';
    };

    if (!filePath.includes('temporary-docs/')) {
      return functions.logger.log('Document is not an applicant doc');
    }

    if (!contentType.startsWith('image/')) {
      return functions.logger.log('This is not an image');
    }

    const { companyId, dashboardId, applicantId, format, angle } = metadata;
    const readableStream = getReadableStream(filePath);
    const resizedImage = await readableStream
      .pipe(toJPEG('resize', { angle }))
      .toBuffer();
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

    promises.push(
      manageFixedFile(fileName, filePath, fixedFilePath, format, angle)
    );
    promises.push(
      manageOriginalFile(
        resizedImage,
        originalFilePath,
        fileName,
        'jpeg',
        imageProperties,
        angle
      )
    );
    await Promise.all(promises);
    await bucket.file(filePath).delete();

    return functions.logger.log('Successfully processed image');
  });

const manageFixedFile = async (
  fileName: string,
  filePath: string,
  newFilePath: string,
  format: ContentTypes,
  angle?: '0' | '90' | '180' | '270'
) => {
  const readableStream = getReadableStream(filePath);
  const imageBuffer = await readableStream
    .pipe(toJPEG('resize'))
    .pipe(toJPEG('fix', { angle }))
    .toBuffer();
  const imageProperties = await getImageProperties(imageBuffer, filePath);
  const writableStream = getWritableStream(newFilePath, {
    contentType: getContentType(format),
    contentDisposition: `inline; filename=${fileName}-original.${format}`,
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
  imageProperties?: FilteredImageProperties,
  angle?: '0' | '90' | '180' | '270'
) => {
  const writableStream = getWritableStream(newFilePath, {
    contentType: getContentType(format),
    contentDisposition: `inline; filename=${fileName}-fixed.${format}`,
    metadata: {
      ...imageProperties,
    },
  });

  const pipeline = sharp(image);
  if (angle !== undefined) {
    pipeline.rotate(parseInt(angle));
  }
  pipeline.pipe(writableStream);

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

const getReadableStream = (filePath: string) => {
  const file = bucket.file(filePath);
  const readableStream = file.createReadStream();
  return readableStream;
};

const getWritableStream = (
  filePath: string,
  metadata: {
    contentType: string;
    contentDisposition?: string;
    metadata?:
      | {
          brightness?: number;
          sharpness?: number;
          contrast?: number;
        }
      | { [key: string]: string };
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

const toJPEG = (
  task: 'resize' | 'fix',
  options?: {
    removeBrightness?: boolean;
    angle?: '0' | '90' | '180' | '270';
  }
) => {
  const pipeline = sharp();
  const BRIGHTNESS_ADJUSTMENT = 1.2;
  if (task === 'resize') {
    pipeline
      .withMetadata() // Keep original metadata of image
      .rotate() // Fix image orientation based on image EXIF data
      .removeAlpha()
      .flatten();

    if (options?.angle) {
      functions.logger.log(options.angle);
    }

    pipeline.resize(NEW_IMAGE_WIDTH).jpeg({ mozjpeg: true });

    return pipeline;
  } else {
    pipeline.sharpen().normalise();
    if (!options?.removeBrightness) {
      pipeline.modulate({
        brightness: BRIGHTNESS_ADJUSTMENT,
      });
    }
    if (options?.angle) {
      pipeline.rotate(parseInt(options.angle));
    }
    return pipeline;
  }
};

const toPDF = (
  image: Buffer,
  dimensions: {
    width: number;
    height: number;
  }
) => {
  const doc = new PDFDocument({
    size: 'A4',
  });
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
