// Logo animation handling
const animations = [
    'animate-glitch-horizontal',
    'animate-glitch-vertical',
    'animate-glitch-diagonal',
    'animate-glitch-color',
    'animate-rainbow'
];

// Function to add row indices to SVG rectangles
function addRowIndices(logoContainer) {
    const rects = logoContainer.querySelectorAll('rect');
    rects.forEach(rect => {
        const y = parseInt(rect.getAttribute('y'));
        rect.style.setProperty('--row-index', y);
    });
}

// Function to apply random animation
function applyRandomAnimation(logoContainer) {
    // Remove any existing animation classes
    animations.forEach(anim => logoContainer.classList.remove(anim));
    
    // Select random animation
    const randomAnim = animations[Math.floor(Math.random() * animations.length)];
    
    // Apply the animation
    logoContainer.classList.add(randomAnim);
    
    // After animation completes, prepare for hover
    setTimeout(() => {
        // Reset the animation state
        logoContainer.style.animation = 'none';
        logoContainer.offsetHeight; // Trigger reflow
        logoContainer.style.animation = null;
        
        // Add a class to indicate animation is ready for hover
        logoContainer.classList.add('animation-ready');
    }, 2000);
}

// Initialize logo animation
export function initLogoAnimation() {
    const logoContainer = document.querySelector('.logo-container');
    
    // Add row indices and apply random animation on page load
    window.addEventListener('load', () => {
        addRowIndices(logoContainer);
        applyRandomAnimation(logoContainer);
    });

    // Apply random animation on hover
    logoContainer.addEventListener('mouseenter', () => applyRandomAnimation(logoContainer));
} 