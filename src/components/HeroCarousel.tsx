"use client";

import { useMemo, useState } from "react";

const slides = [
  {
    title: "CJ Exclusive • Miami Weekend Escape",
    subtitle: "Roundtrip from NYC + 2 nights",
    price: "$299",
    detail: "Includes airport transfer + Wynwood street art tour",
  },
  {
    title: "Flash Fare • Chicago → FLL",
    subtitle: "Nonstop, 4 seats left",
    price: "$119",
    detail: "Travel between Mar 4–10",
  },
  {
    title: "Stay & Play • South Beach",
    subtitle: "Oceanfront king room",
    price: "$79/night",
    detail: "Late checkout + free bike rental",
  },
];

export default function HeroCarousel() {
  const [active, setActive] = useState(0);
  const total = slides.length;

  const activeSlide = useMemo(() => slides[active], [active]);

  return (
    <div className="carousel">
      <div className="carouselCard">
        <p className="carouselTag">CJ Affiliate Mock</p>
        <h3>{activeSlide.title}</h3>
        <p className="carouselSub">{activeSlide.subtitle}</p>
        <p className="carouselPrice">{activeSlide.price}</p>
        <p className="carouselDetail">{activeSlide.detail}</p>
        <div className="carouselActions">
          <button>Book on partner</button>
          <button className="secondary">See details</button>
        </div>
      </div>
      <div className="carouselControls">
        {slides.map((slide, index) => (
          <button
            key={slide.title}
            className={index === active ? "dot active" : "dot"}
            onClick={() => setActive(index)}
            aria-label={`Show slide ${index + 1} of ${total}`}
          />
        ))}
      </div>
      <div className="carouselTrack">
        {slides.map((slide, index) => (
          <div
            className={index === active ? "slide active" : "slide"}
            key={`${slide.title}-${index}`}
          >
            <span>{slide.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
