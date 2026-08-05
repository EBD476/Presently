import React from 'react'
import { useSlideshow } from '../context/SlideshowContext'
import { useI18n } from '../i18n'

export default function Navigation() {
  const { slides, current, goTo, prev, next } = useSlideshow()
  const { t, n } = useI18n()

  return (
    <>
      <button className="nav-arrow prev" id="prevBtn" aria-label={t('navigation.prevSlide')}
        disabled={current === 0} onClick={prev}>&#8249;</button>
      <button className="nav-arrow next" id="nextBtn" aria-label={t('navigation.nextSlide')}
        disabled={current === slides.length - 1} onClick={next}>&#8250;</button>

      <div className="dots" id="dots">
        {slides.map((_, i) => (
          <button key={i} className={'dot' + (i === current ? ' active' : '')}
            aria-label={t('navigation.goToSlide', { n: n(i + 1) })} onClick={() => goTo(i)} />
        ))}
      </div>

      <div className="progress-bar" id="progressBar"
        style={{ width: ((current + 1) / slides.length * 100) + '%' }} />
    </>
  )
}
