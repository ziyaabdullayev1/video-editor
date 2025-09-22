'use client';

import { useRef, useState } from 'react';

interface VideoUploadProps {
  onVideoSelect: (file: File) => void;
  currentVideo: string | null;
  onClearVideo: () => void;
}

const VideoUpload = ({ onVideoSelect, currentVideo, onClearVideo }: VideoUploadProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (file: File) => {
    console.log('📁 Video file selected:', file.name, file.size, 'bytes');
    
    // Validate file type
    if (!file.type.startsWith('video/')) {
      alert('Lütfen bir video dosyası seçin (MP4, WebM, MOV, etc.)');
      return;
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      alert('Video dosyası çok büyük. Maksimum 100MB olmalı.');
      return;
    }

    setUploading(true);
    
    // Create object URL for the video
    const videoUrl = URL.createObjectURL(file);
    console.log('🎬 Video URL created:', videoUrl);
    
    onVideoSelect(file);
    setUploading(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="panel mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold">Video Yükle</h3>
        {currentVideo && (
          <button 
            onClick={onClearVideo}
            className="btn btn-danger text-sm"
            title="Mevcut videoyu temizle"
          >
            🗑️ Temizle
          </button>
        )}
      </div>

      {!currentVideo ? (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
            dragOver 
              ? 'border-blue-400 bg-blue-50 bg-opacity-10' 
              : 'border-gray-600 hover:border-gray-500'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={openFileDialog}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileInput}
            className="hidden"
          />
          
          {uploading ? (
            <div className="text-blue-400">
              <div className="animate-pulse mb-2">📤</div>
              <div>Video yükleniyor...</div>
            </div>
          ) : (
            <div className="text-gray-300">
              <div className="text-4xl mb-3">🎬</div>
              <div className="text-lg mb-2">Video dosyası seçin</div>
              <div className="text-sm text-gray-400 mb-3">
                Buraya sürükleyip bırakın veya tıklayın
              </div>
              <div className="text-xs text-gray-500">
                Desteklenen formatlar: MP4, WebM, MOV, AVI<br/>
                Maksimum boyut: 100MB
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-green-900 bg-opacity-30 border border-green-600 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="text-green-400 text-2xl">✅</div>
            <div>
              <div className="text-green-300 font-medium">Video yüklendi</div>
              <div className="text-sm text-gray-400">
                Artık timeline'da düzenleme yapabilirsiniz
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoUpload;
