import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContactModalService } from '../../shared/contact/contact-modal';

interface Highlight {
  title: string;
  description: string;
}

interface FeaturedProject {
  title: string;
  description: string;
  image: string;
  liveUrl: string;
}

@Component({
  imports: [RouterLink],
  selector: 'app-home',
  styleUrl: './home.scss',
  templateUrl: './home.html',
})
export class Home {
  protected readonly heroStack: string[] = ['WordPress', 'PHP', 'JavaScript', 'SCSS'];

  constructor(private readonly contact: ContactModalService) {}

  protected openContact(): void {
    this.contact.open();
  }

  protected readonly highlights: Highlight[] = [
    {
      title: 'Bringing Designs to Life',
      description:
        'I turn Figma files and mockups into enterprise level websites that meet the needs of the client and look good doing it.',
    },
    {
      title: 'Performance for Everyone',
      description:
        'Fast load speeds, strong security, and accessibility that meets ADA standards. I create sites that are more than just eye candy.',
    },
    {
      title: 'Comfortable Across the Stack',
      description:
        'From custom WordPress and Shopify themes, to snappy Angular web apps (like this site!), I am capable of working within whatever tech stack the project needs.',
    },
  ];

  protected readonly skills: string[] = [
    'JavaScript',
    'CSS & SCSS',
    'PHP',
    'HTML',
    'Three.js',
    'TypeScript',
    'Angular',
    'React',
    'Liquid',
    'Node.js',
    'WordPress',
    'Shopify',
    'Git',
    'npm',
  ];

  protected readonly featuredProjects: FeaturedProject[] = [
    {
      title: 'Ehlers Inc.',
      description: 'Custom WordPress theme for a public financial advisory firm.',
      image: 'images/ehlers-inc.jpg',
      liveUrl: 'https://www.ehlers-inc.com/',
    },
    {
      title: 'Mercury Mosaics',
      description: 'Shopify storefront for an artisan tile studio.',
      image: 'images/mercury-mosaics.jpg',
      liveUrl: 'https://mercurymosaics.com/',
    },
    {
      title: 'Media Loft',
      description: 'Custom WordPress theme for a live events agency.',
      image: 'images/medialoft.png',
      liveUrl: 'https://www.medialoft.com/',
    },
  ];
}
