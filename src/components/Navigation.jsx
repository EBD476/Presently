import React from 'react'
import { useSlideshow } from '../context/SlideshowContext'

export default function Navigation() {
  const { slides, current, goTo, prev, next } = useSlideshow()

  return (
    <>
      <button className="nav-arrow prev" id="prevBtn" aria-label="Previous slide"
        disabled={current === 0} onClick={prev}>&#8249;</button>
      <button className="nav-arrow next" id="nextBtn" aria-label="Next slide"
        disabled={current === slides.length - 1} onClick={next}>&#8250;</button>

      <div className="dots" id="dots">
        {slides.map((_, i) => (
          <button key={i} className={'dot' + (i === current ? ' active' : '')}
            aria-label={'Go to slide ' + (i + 1)} onClick={() => goTo(i)} />
        ))}
      </div>

      <div className="progress-bar" id="progressBar"
        style={{ width: ((current + 1) / slides.length * 100) + '%' }} />
    </>
  )
}
