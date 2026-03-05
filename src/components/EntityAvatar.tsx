import { getImageUrl } from '../tmdb'

interface EntityAvatarProps {
  imagePath: string | null
  title: string
  className: string
  alt?: string
}

function EntityAvatar({ imagePath, title, className, alt = '' }: EntityAvatarProps) {
  const imageUrl = getImageUrl(imagePath)

  return (
    <span className={className} aria-hidden={alt === ''}>
      {imageUrl ? <img src={imageUrl} alt={alt} className="h-full w-full object-cover" /> : title.slice(0, 2).toUpperCase()}
    </span>
  )
}

export default EntityAvatar
