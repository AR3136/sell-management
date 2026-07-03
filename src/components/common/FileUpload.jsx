import { useState, useRef } from 'react';
import { uploadFile } from '../../services/storageService';
import Button from '../common/Button';

export default function FileUpload({ onUploadSuccess, label = "Upload File", multiple = true }) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadPromises = files.map(async (file) => {
        const publicUrl = await uploadFile(file);
        return { publicUrl, name: file.name };
      });

      const results = await Promise.all(uploadPromises);
      results.forEach((res) => {
        if (res.publicUrl) {
          onUploadSuccess(res.publicUrl, res.name);
        }
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="file-upload-container" style={{ margin: 'var(--space-2) 0' }}>
      <label className="input-field__label">{label}</label>
      <div className="flex items-center gap-3" style={{ marginTop: 'var(--space-1)' }}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          disabled={isUploading}
          multiple={multiple}
          style={{ display: 'none' }}
        />
        <Button
          type="button"
          variant="outline"
          icon={isUploading ? "autorenew" : "cloud_upload"}
          disabled={isUploading}
          onClick={handleButtonClick}
        >
          {isUploading ? "Uploading..." : "Choose Files"}
        </Button>
      </div>
    </div>
  );
}
