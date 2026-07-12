export function MockMulterFile(buffer: Buffer, originalname: string) {
	const mockFile = {
		originalname,
		buffer,
	} as unknown as Express.Multer.File;

	return mockFile;
}
