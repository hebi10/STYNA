'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Product } from '@/shared/types/product';
import { CategoryProvider, useCategories } from '@/context/categoryProvider';
import useInputs from '@/shared/hooks/useInput';
import { 
  uploadProductImages, 
  deleteProductImage, 
  validateImageFiles,
  createPreviewUrl,
  revokePreviewUrl 
} from '@/shared/libs/firebase/storage';
import styles from './EditProductForm.module.css';

// 색상명을 CSS 색상값으로 변환하는 함수
const getColorValue = (colorName: string): string => {
  const colorMap: Record<string, string> = {
    '검정': '#000000',
    '검은색': '#000000',
    '블랙': '#000000',
    'black': '#000000',
    '흰색': '#ffffff',
    '화이트': '#ffffff',
    'white': '#ffffff',
    '빨간색': '#dc3545',
    '빨강': '#dc3545',
    '레드': '#dc3545',
    'red': '#dc3545',
    '파란색': '#007bff',
    '파랑': '#007bff',
    '블루': '#007bff',
    'blue': '#007bff',
    '초록색': '#28a745',
    '초록': '#28a745',
    '그린': '#28a745',
    'green': '#28a745',
    '노란색': '#ffc107',
    '노랑': '#ffc107',
    '옐로우': '#ffc107',
    'yellow': '#ffc107',
    '보라색': '#6f42c1',
    '보라': '#6f42c1',
    '퍼플': '#6f42c1',
    'purple': '#6f42c1',
    '분홍색': '#e83e8c',
    '분홍': '#e83e8c',
    '핑크': '#e83e8c',
    'pink': '#e83e8c',
    '주황색': '#fd7e14',
    '주황': '#fd7e14',
    '오렌지': '#fd7e14',
    'orange': '#fd7e14',
    '회색': '#6c757d',
    '그레이': '#6c757d',
    'gray': '#6c757d',
    'grey': '#6c757d',
    '네이비': '#1a1a2e',
    'navy': '#1a1a2e',
    '베이지': '#f5f5dc',
    'beige': '#f5f5dc',
    '갈색': '#8b4513',
    '브라운': '#8b4513',
    'brown': '#8b4513'
  };
  
  return colorMap[colorName.toLowerCase()] || '#cccccc';
};

// 입력 컴포넌트들
interface InputProps {
  onAdd: (value: string) => void;
  disabled?: boolean;
}

const SizeInput = ({ onAdd, disabled }: InputProps) => {
  const [value, setValue] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onAdd(value.trim());
      setValue('');
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className={styles.addInput}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="사이즈 입력 (예: S, M, L, XL)"
        className={styles.input}
        disabled={disabled}
      />
      <button
        type="submit"
        className={styles.addButton}
        disabled={disabled || !value.trim()}
      >
        추가
      </button>
    </form>
  );
};

const ColorInput = ({ onAdd, disabled }: InputProps) => {
  const [value, setValue] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onAdd(value.trim());
      setValue('');
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className={styles.addInput}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="색상 입력 (예: 검정, 흰색, 네이비)"
        className={styles.input}
        disabled={disabled}
      />
      <button
        type="submit"
        className={styles.addButton}
        disabled={disabled || !value.trim()}
      >
        추가
      </button>
    </form>
  );
};

const TagInput = ({ onAdd, disabled }: InputProps) => {
  const [value, setValue] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onAdd(value.trim());
      setValue('');
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className={styles.addInput}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="태그 입력 (예: 신상품, 베스트)"
        className={styles.input}
        disabled={disabled}
      />
      <button
        type="submit"
        className={styles.addButton}
        disabled={disabled || !value.trim()}
      >
        추가
      </button>
    </form>
  );
};

interface EditProductFormProps {
  product: Product;
  onSave: (updatedProduct: Product) => void;
  onCancel: () => void;
}

function EditProductFormContent({ product, onSave, onCancel }: EditProductFormProps) {
  const { categories, loading: categoriesLoading } = useCategories();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [isSaving, setIsSaving] = useState(false);

  // useInputs로 기본 필드들 관리
  const [basicFields, onChangeBasic] = useInputs({
    name: product.name,
    price: product.price.toString(),
    originalPrice: product.originalPrice?.toString() || '',
    description: product.description,
    brand: product.brand,
    category: product.category,
    stock: product.stock.toString(),
    sku: product.sku || '',
    saleRate: product.saleRate?.toString() || '',
    material: product.details?.material || '',
    origin: product.details?.origin || '',
    manufacturer: product.details?.manufacturer || '',
    precautions: product.details?.precautions || ''
  });

  // 복잡한 필드들은 별도 state로 관리
  const [complexFields, setComplexFields] = useState({
    images: product.images || [],
    mainImage: product.mainImage || '',
    sizes: product.sizes || [],
    colors: product.colors || [],
    tags: product.tags || [],
    isNew: product.isNew || false,
    isSale: product.isSale || false,
    status: product.status || 'active',
    rating: product.rating || 0,
    reviewCount: product.reviewCount || 0
  });

  // 사이즈 관련 상태
  const [sizeDetails, setSizeDetails] = useState<Product['details']['sizes']>(product.details?.sizes || {});
  
  // 이미지 미리보기 URL 관리
  const [previewUrls, setPreviewUrls] = useState<string[]>(() => product.images || []);
  const blobPreviewUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      // 컴포넌트 언마운트 시 미리보기 URL 정리
      blobPreviewUrlsRef.current.forEach(url => revokePreviewUrl(url));
    };
  }, []);

  // 이미지 업로드 처리
  const handleImageUpload = async (files: FileList) => {
    if (!files || files.length === 0) return;

    try {
      // 파일 유효성 검사
      const validationResult = validateImageFiles(Array.from(files));
      if (validationResult.errors.length > 0) {
        alert(validationResult.errors.join('\n'));
        return;
      }

      setUploading(true);

      // 미리보기 URL 생성
      const newPreviewUrls = Array.from(files).map(file => createPreviewUrl(file));
      blobPreviewUrlsRef.current.push(...newPreviewUrls);
      
      // 기존 미리보기에 추가
      setPreviewUrls(prev => [...prev, ...newPreviewUrls]);
      
      // Firebase Storage에 업로드
      const uploadResults = await uploadProductImages(
        Array.from(files),
        basicFields.category || product.category || 'others',
        product.id,
        (progress: number, fileName: string) => {
          setUploadProgress(prev => ({
            ...prev,
            [fileName]: progress
          }));
        }
      );

      // 업로드된 이미지 URL을 상태에 추가
      const newImageUrls = uploadResults;
      setComplexFields(prev => ({
        ...prev,
        images: [...prev.images, ...newImageUrls]
      }));

      // 첫 번째 이미지가 없으면 메인 이미지로 설정
      if (!complexFields.mainImage && newImageUrls.length > 0) {
        setComplexFields(prev => ({
          ...prev,
          mainImage: newImageUrls[0]
        }));
      }

      // 미리보기 URL을 실제 URL로 교체
      setPreviewUrls(prev => {
        const filtered = prev.filter(url => !newPreviewUrls.includes(url));
        return [...filtered, ...newImageUrls];
      });

      // 임시 미리보기 URL 정리
      newPreviewUrls.forEach(url => revokePreviewUrl(url));
      blobPreviewUrlsRef.current = blobPreviewUrlsRef.current.filter(url => !newPreviewUrls.includes(url));

    } catch (error) {
      console.error('이미지 업로드 실패:', error);
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      setUploadProgress({});
    }
  };

  // 이미지 삭제 처리
  const handleImageDelete = async (imageUrl: string, index: number) => {
    if (!confirm('이 이미지를 삭제하시겠습니까?')) return;

    try {
      // Firebase Storage에서 이미지 삭제 (URL이 Firebase Storage URL인 경우만)
      if (imageUrl.includes('firebasestorage.googleapis.com')) {
        await deleteProductImage(imageUrl);
      }

      // 상태에서 이미지 제거
      setComplexFields(prev => ({
        ...prev,
        images: prev.images.filter((_, i) => i !== index)
      }));

      // 미리보기에서도 제거
      setPreviewUrls(prev => prev.filter((_, i) => i !== index));

      // 삭제된 이미지가 메인 이미지였다면 첫 번째 이미지를 메인으로 설정
      if (complexFields.mainImage === imageUrl) {
        const remainingImages = complexFields.images.filter((_, i) => i !== index);
        setComplexFields(prev => ({
          ...prev,
          mainImage: remainingImages.length > 0 ? remainingImages[0] : ''
        }));
      }

    } catch (error) {
      console.error('이미지 삭제 실패:', error);
      alert('이미지 삭제에 실패했습니다.');
    }
  };

  // 메인 이미지 설정
  const handleSetMainImage = (imageUrl: string) => {
    setComplexFields(prev => ({
      ...prev,
      mainImage: imageUrl
    }));
  };

  // 태그 추가
  const handleAddTag = (tag: string) => {
    if (tag.trim() && !complexFields.tags.includes(tag.trim())) {
      setComplexFields(prev => ({
        ...prev,
        tags: [...prev.tags, tag.trim()]
      }));
    }
  };

  // 태그 제거
  const handleRemoveTag = (tagToRemove: string) => {
    setComplexFields(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  // 사이즈 추가
  const handleAddSize = (size: string) => {
    if (size.trim() && !complexFields.sizes.includes(size.trim())) {
      setComplexFields(prev => ({
        ...prev,
        sizes: [...prev.sizes, size.trim()]
      }));
    }
  };

  // 사이즈 제거
  const handleRemoveSize = (sizeToRemove: string) => {
    setComplexFields(prev => ({
      ...prev,
      sizes: prev.sizes.filter(size => size !== sizeToRemove)
    }));
    
    // 사이즈 상세 정보도 제거
    setSizeDetails(prev => {
      const newDetails = { ...prev };
      delete newDetails[sizeToRemove];
      return newDetails;
    });
  };

  // 색상 추가
  const handleAddColor = (color: string) => {
    if (color.trim() && !complexFields.colors.includes(color.trim())) {
      setComplexFields(prev => ({
        ...prev,
        colors: [...prev.colors, color.trim()]
      }));
    }
  };

  // 색상 제거
  const handleRemoveColor = (colorToRemove: string) => {
    setComplexFields(prev => ({
      ...prev,
      colors: prev.colors.filter(color => color !== colorToRemove)
    }));
  };

  // 저장 처리 (중복 요청 방지)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 이미 저장 중이거나 업로드 중이면 무시
    if (isSaving || uploading) {
      console.log('이미 처리 중입니다. 중복 요청을 무시합니다.');
      return;
    }

    try {
      setIsSaving(true);

      // undefined 값을 제거하는 함수
      const cleanObject = (obj: Product): Product => {
        return Object.fromEntries(
          Object.entries(obj).filter(([, value]) => value !== undefined)
        ) as Product;
      };

      const productData: Product = {
        ...product,
        name: basicFields.name,
        description: basicFields.description,
        price: parseInt(basicFields.price) || 0,
        originalPrice: basicFields.originalPrice ? parseInt(basicFields.originalPrice) : undefined,
        brand: basicFields.brand,
        category: basicFields.category,
        stock: parseInt(basicFields.stock) || 0,
        sku: basicFields.sku,
        saleRate: basicFields.saleRate ? parseInt(basicFields.saleRate) : undefined,
        images: complexFields.images,
        mainImage: complexFields.mainImage,
        sizes: complexFields.sizes,
        colors: complexFields.colors,
        tags: complexFields.tags,
        isNew: complexFields.isNew,
        isSale: complexFields.isSale,
        status: complexFields.status as 'active' | 'inactive' | 'draft',
        rating: complexFields.rating,
        reviewCount: complexFields.reviewCount,
        details: {
          ...product.details,
          material: basicFields.material,
          origin: basicFields.origin,
          manufacturer: basicFields.manufacturer,
          precautions: basicFields.precautions,
          sizes: sizeDetails
        },
        updatedAt: new Date()
      };

      // undefined 값 제거
      const updatedProduct: Product = cleanObject(productData);

      await onSave(updatedProduct);
    } catch (error) {
      console.error('상품 저장 실패:', error);
      alert('상품 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {/* 기본 정보 섹션 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>기본 정보</h3>
        
        <div className={styles.formGroup}>
          <label className={styles.label}>상품명 *</label>
          <input
            type="text"
            name="name"
            value={basicFields.name}
            onChange={onChangeBasic}
            className={styles.input}
            required
          />
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>브랜드 *</label>
            <input
              type="text"
              name="brand"
              value={basicFields.brand}
              onChange={onChangeBasic}
              className={styles.input}
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label className={styles.label}>카테고리 *</label>
            <select
              name="category"
              value={basicFields.category}
              onChange={onChangeBasic}
              className={styles.select}
              required
              disabled={categoriesLoading}
            >
              <option value="">
                {categoriesLoading ? '카테고리 불러오는 중...' : '카테고리 선택'}
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name} ({category.id})
                </option>
              ))}
            </select>
            {categoriesLoading && (
              <div className={styles.loadingText}>카테고리를 불러오는 중...</div>
            )}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>상품 설명</label>
          <textarea
            name="description"
            value={basicFields.description}
            onChange={onChangeBasic}
            className={styles.textarea}
            rows={4}
          />
        </div>
      </div>

      {/* 가격 정보 섹션 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>가격 정보</h3>
        
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>판매가 *</label>
            <input
              type="number"
              name="price"
              value={basicFields.price}
              onChange={onChangeBasic}
              className={styles.input}
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label className={styles.label}>정가</label>
            <input
              type="number"
              name="originalPrice"
              value={basicFields.originalPrice}
              onChange={onChangeBasic}
              className={styles.input}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label className={styles.label}>할인율 (%)</label>
            <input
              type="number"
              name="saleRate"
              value={basicFields.saleRate}
              onChange={onChangeBasic}
              className={styles.input}
              min="0"
              max="100"
            />
          </div>
        </div>
      </div>

      {/* 재고 및 상태 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>재고 및 상태</h3>
        
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>재고 수량 *</label>
            <input
              type="number"
              name="stock"
              value={basicFields.stock}
              onChange={onChangeBasic}
              className={styles.input}
              required
              min="0"
            />
          </div>
          
          <div className={styles.formGroup}>
            <label className={styles.label}>SKU</label>
            <input
              type="text"
              name="sku"
              value={basicFields.sku}
              onChange={onChangeBasic}
              className={styles.input}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label className={styles.label}>상품 상태</label>
            <select
              value={complexFields.status}
              onChange={(e) => setComplexFields(prev => ({ 
                ...prev, 
                status: e.target.value as 'active' | 'inactive' | 'draft'
              }))}
              className={styles.select}
            >
              <option value="active">판매중</option>
              <option value="inactive">판매중지</option>
              <option value="draft">임시저장</option>
            </select>
          </div>
        </div>
      </div>

      {/* 사이즈 및 색상 섹션 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>사이즈 및 색상</h3>
        
        {/* 사이즈 관리 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>사이즈</label>
          <div className={styles.sizeList}>
            {complexFields.sizes.map((size) => (
              <div key={size} className={styles.sizeItem}>
                <span>{size}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSize(size)}
                  className={styles.removeButton}
                  disabled={uploading}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <SizeInput onAdd={handleAddSize} disabled={uploading} />
        </div>

        {/* 색상 관리 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>색상</label>
          <div className={styles.colorList}>
            {complexFields.colors.map((color) => (
              <div key={color} className={styles.colorItem}>
                <div 
                  className={styles.colorPreview}
                  style={{ backgroundColor: getColorValue(color) }}
                  title={color}
                />
                <span>{color}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveColor(color)}
                  className={styles.removeButton}
                  disabled={uploading}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <ColorInput onAdd={handleAddColor} disabled={uploading} />
        </div>

        {/* 태그 관리 */}
        <div className={styles.formGroup}>
          <label className={styles.label}>태그</label>
          <div className={styles.tagList}>
            {complexFields.tags.map((tag) => (
              <div key={tag} className={styles.tag}>
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className={styles.removeButton}
                  disabled={uploading}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <TagInput onAdd={handleAddTag} disabled={uploading} />
        </div>
      </div>

      {/* 상품 옵션 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>상품 옵션</h3>
        
        <div className={styles.checkboxGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={complexFields.isNew}
              onChange={(e) => setComplexFields(prev => ({ ...prev, isNew: e.target.checked }))}
              className={styles.checkbox}
            />
            신상품
          </label>
          
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={complexFields.isSale}
              onChange={(e) => setComplexFields(prev => ({ ...prev, isSale: e.target.checked }))}
              className={styles.checkbox}
            />
            할인상품
          </label>
        </div>
      </div>

      {/* 이미지 섹션 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>상품 이미지</h3>
        
        <div className={styles.imageUpload}>
          <input
            type="file"
            id="imageUpload"
            multiple
            accept="image/*"
            onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
            className={styles.fileInput}
            disabled={uploading}
          />
          <label htmlFor="imageUpload" className={styles.uploadButton}>
            {uploading ? '업로드 중...' : '이미지 추가'}
          </label>
        </div>

        {previewUrls.length > 0 && (
          <div className={styles.imageGrid}>
            {previewUrls.map((url, index) => (
              <div key={index} className={styles.imageItem}>
                <Image
                  src={url}
                  alt={`상품 이미지 ${index + 1}`}
                  width={160}
                  height={160}
                  className={styles.image}
                  unoptimized
                />
                <div className={styles.imageActions}>
                  <button
                    type="button"
                    onClick={() => handleSetMainImage(url)}
                    className={`${styles.mainButton} ${complexFields.mainImage === url ? styles.isMain : ''}`}
                    disabled={uploading}
                  >
                    {complexFields.mainImage === url ? '메인' : '메인으로'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleImageDelete(url, index)}
                    className={styles.deleteButton}
                    disabled={uploading}
                  >
                    삭제
                  </button>
                </div>
                {uploadProgress[`image_${index}`] && (
                  <div className={styles.progress}>
                    <div 
                      className={styles.progressBar}
                      style={{ width: `${uploadProgress[`image_${index}`]}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 상세 정보 섹션 */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>상세 정보</h3>
        
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>소재</label>
            <input
              type="text"
              name="material"
              value={basicFields.material}
              onChange={onChangeBasic}
              className={styles.input}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label className={styles.label}>원산지</label>
            <input
              type="text"
              name="origin"
              value={basicFields.origin}
              onChange={onChangeBasic}
              className={styles.input}
            />
          </div>
        </div>
        
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>제조사</label>
            <input
              type="text"
              name="manufacturer"
              value={basicFields.manufacturer}
              onChange={onChangeBasic}
              className={styles.input}
            />
          </div>
        </div>
        
        <div className={styles.formGroup}>
          <label className={styles.label}>취급주의사항</label>
          <textarea
            name="precautions"
            value={basicFields.precautions}
            onChange={onChangeBasic}
            className={styles.textarea}
            rows={3}
          />
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className={styles.actions}>
        <button
          type="button"
          onClick={onCancel}
          className={styles.cancelButton}
          disabled={uploading}
        >
          취소
        </button>
        <button
          type="submit"
          className={styles.saveButton}
          disabled={uploading || isSaving}
        >
          {uploading ? '업로드 중...' : isSaving ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  );
}

export default function EditProductForm(props: EditProductFormProps) {
  return (
    <CategoryProvider>
      <EditProductFormContent {...props} />
    </CategoryProvider>
  );
}
