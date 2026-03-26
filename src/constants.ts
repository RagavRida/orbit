import { Startup } from "./types";

export function dedupeStartups(arr: Startup[]): Startup[] {
  const seen = new Set<string>();
  return arr.filter((s) => {
    const key = s.name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const _RAW_STARTUPS: Startup[] = [
  // ═══════════════════════════════════════════════════
  // NORTH AMERICA
  // ═══════════════════════════════════════════════════

  // USA - San Francisco / Bay Area
  { name: "OpenAI", tagline: "Ensuring AGI benefits all of humanity.", city: "San Francisco", country: "USA", industry: "AI", logo: "https://logo.clearbit.com/openai.com", lat: 37.7749, lng: -122.4194, founder_quote: "AGI is coming, and we must ensure it is safe.", founding_year: 2015 },
  { name: "Anthropic", tagline: "AI safety and research company.", city: "San Francisco", country: "USA", industry: "AI", logo: "https://logo.clearbit.com/anthropic.com", lat: 37.7850, lng: -122.4000, founder_quote: "Building reliable, interpretable AI systems.", founding_year: 2021 },
  { name: "Stripe", tagline: "Financial infrastructure for the internet.", city: "San Francisco", country: "USA", industry: "Fintech", logo: "https://logo.clearbit.com/stripe.com", lat: 37.7900, lng: -122.3930, founder_quote: "Increase the GDP of the internet.", founding_year: 2010 },
  { name: "Airbnb", tagline: "Belong anywhere.", city: "San Francisco", country: "USA", industry: "Consumer", logo: "https://logo.clearbit.com/airbnb.com", lat: 37.7710, lng: -122.4050, founder_quote: "A world where anyone can belong anywhere.", founding_year: 2008 },
  { name: "Uber", tagline: "Move the way you want.", city: "San Francisco", country: "USA", industry: "Consumer", logo: "https://logo.clearbit.com/uber.com", lat: 37.7755, lng: -122.4180, founder_quote: "Transportation as reliable as running water.", founding_year: 2009 },
  { name: "Coinbase", tagline: "The future of finance is here.", city: "San Francisco", country: "USA", industry: "Fintech", logo: "https://logo.clearbit.com/coinbase.com", lat: 37.7820, lng: -122.3950, founder_quote: "Creating an open financial system.", founding_year: 2012 },
  { name: "Figma", tagline: "Where teams design together.", city: "San Francisco", country: "USA", industry: "SaaS", logo: "https://logo.clearbit.com/figma.com", lat: 37.7680, lng: -122.4100, founder_quote: "Design should be accessible to everyone.", founding_year: 2012 },
  { name: "Notion", tagline: "All-in-one workspace.", city: "San Francisco", country: "USA", industry: "SaaS", logo: "https://logo.clearbit.com/notion.so", lat: 37.7790, lng: -122.4220, founder_quote: "Tools should adapt to you.", founding_year: 2013 },
  { name: "Rippling", tagline: "The way people should manage HR, IT & Finance.", city: "San Francisco", country: "USA", industry: "SaaS", logo: "https://logo.clearbit.com/rippling.com", lat: 37.7830, lng: -122.4090, founder_quote: "Unifying all employee systems.", founding_year: 2016 },
  { name: "Perplexity AI", tagline: "Where knowledge begins.", city: "San Francisco", country: "USA", industry: "AI", logo: "https://logo.clearbit.com/perplexity.ai", lat: 37.7870, lng: -122.4150, founder_quote: "Reinventing search with AI.", founding_year: 2022 },
  { name: "Scale AI", tagline: "Accelerating AI development.", city: "San Francisco", country: "USA", industry: "AI", logo: "https://logo.clearbit.com/scale.com", lat: 37.7750, lng: -122.4250, founder_quote: "Data infrastructure for AI.", founding_year: 2016 },
  { name: "Neuralink", tagline: "Developing brain-machine interfaces.", city: "San Francisco", country: "USA", industry: "Health", logo: "https://logo.clearbit.com/neuralink.com", lat: 37.7690, lng: -122.4300, founder_quote: "The future of human-computer interaction.", founding_year: 2016 },
  { name: "Databricks", tagline: "The data and AI company.", city: "San Francisco", country: "USA", industry: "AI", logo: "https://logo.clearbit.com/databricks.com", lat: 37.7810, lng: -122.3900, founder_quote: "Unifying data, analytics and AI.", founding_year: 2013 },
  { name: "Discord", tagline: "Your place to talk and hang out.", city: "San Francisco", country: "USA", industry: "Consumer", logo: "https://logo.clearbit.com/discord.com", lat: 37.7770, lng: -122.3960, founder_quote: "Bringing people together around shared experiences.", founding_year: 2015 },
  { name: "DoorDash", tagline: "Delivery for every occasion.", city: "San Francisco", country: "USA", industry: "Consumer", logo: "https://logo.clearbit.com/doordash.com", lat: 37.7840, lng: -122.4020, founder_quote: "Empowering local economies.", founding_year: 2013 },
  { name: "Instacart", tagline: "Groceries delivered in as fast as 1 hour.", city: "San Francisco", country: "USA", industry: "Consumer", logo: "https://logo.clearbit.com/instacart.com", lat: 37.7760, lng: -122.4170, founder_quote: "Delivering the grocery store to your door.", founding_year: 2012 },
  
  // USA - New York
  { name: "Hugging Face", tagline: "The AI community building the future.", city: "New York", country: "USA", industry: "AI", logo: "https://logo.clearbit.com/huggingface.co", lat: 40.7128, lng: -74.0060, founder_quote: "Democratizing good machine learning.", founding_year: 2016 },
  { name: "UiPath", tagline: "The automated enterprise.", city: "New York", country: "USA", industry: "SaaS", logo: "https://logo.clearbit.com/uipath.com", lat: 40.7180, lng: -73.9950, founder_quote: "A robot for every person.", founding_year: 2005 },
  { name: "Ramp", tagline: "The corporate card that helps you spend less.", city: "New York", country: "USA", industry: "Fintech", logo: "https://logo.clearbit.com/ramp.com", lat: 40.7200, lng: -74.0000, founder_quote: "Saving companies time and money.", founding_year: 2019 },
  { name: "Brex", tagline: "Business finance reimagined.", city: "New York", country: "USA", industry: "Fintech", logo: "https://logo.clearbit.com/brex.com", lat: 40.7250, lng: -73.9980, founder_quote: "The financial OS for the next generation.", founding_year: 2017 },
  { name: "Peloton", tagline: "The best cardio at home.", city: "New York", country: "USA", industry: "Consumer", logo: "https://logo.clearbit.com/onepeloton.com", lat: 40.7300, lng: -73.9920, founder_quote: "Bringing the studio experience home.", founding_year: 2012 },

  // USA - Other Cities
  { name: "SpaceX", tagline: "Making life multi-planetary.", city: "Hawthorne", country: "USA", industry: "Climate", logo: "https://logo.clearbit.com/spacex.com", lat: 33.9214, lng: -118.3280, founder_quote: "Making humanity a multi-planetary species.", founding_year: 2002 },
  { name: "Palantir", tagline: "Data-driven decisions.", city: "Denver", country: "USA", industry: "AI", logo: "https://logo.clearbit.com/palantir.com", lat: 39.7392, lng: -104.9903, founder_quote: "The world's most important institutions need data.", founding_year: 2003 },
  { name: "Slack", tagline: "Where work happens.", city: "San Francisco", country: "USA", industry: "SaaS", logo: "https://logo.clearbit.com/slack.com", lat: 37.7860, lng: -122.3880, founder_quote: "Making work life simpler and more productive.", founding_year: 2009 },
  { name: "Snowflake", tagline: "The Data Cloud.", city: "Bozeman", country: "USA", industry: "SaaS", logo: "https://logo.clearbit.com/snowflake.com", lat: 45.6770, lng: -111.0429, founder_quote: "Mobilizing the world's data.", founding_year: 2012 },
  { name: "Tesla", tagline: "Accelerating sustainable energy.", city: "Austin", country: "USA", industry: "Climate", logo: "https://logo.clearbit.com/tesla.com", lat: 30.2672, lng: -97.7431, founder_quote: "The future we envision is electric.", founding_year: 2003 },
  { name: "Epic Games", tagline: "We make games and game engines.", city: "Cary", country: "USA", industry: "Consumer", logo: "https://logo.clearbit.com/epicgames.com", lat: 35.7915, lng: -78.7811, founder_quote: "Creators should control their destiny.", founding_year: 1991 },
  { name: "Rivian", tagline: "Electric adventure vehicles.", city: "Irvine", country: "USA", industry: "Climate", logo: "https://logo.clearbit.com/rivian.com", lat: 33.6846, lng: -117.8265, founder_quote: "Keep the world adventurous forever.", founding_year: 2009 },
  { name: "Anduril", tagline: "Transforming defense with technology.", city: "Costa Mesa", country: "USA", industry: "AI", logo: "https://logo.clearbit.com/anduril.com", lat: 33.6615, lng: -117.9037, founder_quote: "National security deserves Silicon Valley innovation.", founding_year: 2017 },

  // Canada
  { name: "Shopify", tagline: "Making commerce better for everyone.", city: "Ottawa", country: "Canada", industry: "SaaS", logo: "https://logo.clearbit.com/shopify.com", lat: 45.4215, lng: -75.6972, founder_quote: "Making commerce better for everyone.", founding_year: 2006 },
  { name: "Cohere", tagline: "AI for the enterprise.", city: "Toronto", country: "Canada", industry: "AI", logo: "https://logo.clearbit.com/cohere.com", lat: 43.6532, lng: -79.3832, founder_quote: "Empowering every developer to use NLP.", founding_year: 2019 },
  { name: "Wealthsimple", tagline: "Investing for everyone.", city: "Toronto", country: "Canada", industry: "Fintech", logo: "https://logo.clearbit.com/wealthsimple.com", lat: 43.6480, lng: -79.3880, founder_quote: "Financial freedom is a right, not a privilege.", founding_year: 2014 },
  { name: "Clio", tagline: "Cloud-based legal software.", city: "Vancouver", country: "Canada", industry: "SaaS", logo: "https://logo.clearbit.com/clio.com", lat: 49.2827, lng: -123.1207, founder_quote: "Transforming the legal experience.", founding_year: 2008 },

  // ═══════════════════════════════════════════════════
  // LATIN AMERICA
  // ═══════════════════════════════════════════════════
  { name: "Nubank", tagline: "The future of banking.", city: "Sao Paulo", country: "Brazil", industry: "Fintech", logo: "https://logo.clearbit.com/nubank.com.br", lat: -23.5505, lng: -46.6333, founder_quote: "Fighting complexity to empower people.", founding_year: 2013 },
  { name: "Mercado Libre", tagline: "Leading e-commerce in Latin America.", city: "Buenos Aires", country: "Argentina", industry: "Consumer", logo: "https://logo.clearbit.com/mercadolibre.com", lat: -34.6037, lng: -58.3816, founder_quote: "Democratizing commerce across Latin America.", founding_year: 1999 },
  { name: "Rappi", tagline: "The super-app of Latin America.", city: "Bogota", country: "Colombia", industry: "Consumer", logo: "https://logo.clearbit.com/rappi.com", lat: 4.7110, lng: -74.0721, founder_quote: "Transforming how people live in LatAm.", founding_year: 2015 },
  { name: "Clip", tagline: "Fintech for Mexican SMBs.", city: "Mexico City", country: "Mexico", industry: "Fintech", logo: "https://logo.clearbit.com/clip.mx", lat: 19.4326, lng: -99.1332, founder_quote: "Empowering entrepreneurs across Mexico.", founding_year: 2012 },
  { name: "iFood", tagline: "Brazil's leading food delivery.", city: "Sao Paulo", country: "Brazil", industry: "Consumer", logo: "https://logo.clearbit.com/ifood.com.br", lat: -23.5600, lng: -46.6450, founder_quote: "Feeding the future of Brazil.", founding_year: 2011 },
  { name: "Kavak", tagline: "Reinventing the car market.", city: "Mexico City", country: "Mexico", industry: "Consumer", logo: "https://logo.clearbit.com/kavak.com", lat: 19.4400, lng: -99.1400, founder_quote: "Making car buying easy.", founding_year: 2016 },
  { name: "dLocal", tagline: "Cross-border payments for emerging markets.", city: "Montevideo", country: "Uruguay", industry: "Fintech", logo: "https://logo.clearbit.com/dlocal.com", lat: -34.9011, lng: -56.1645, founder_quote: "Connecting global merchants to emerging markets.", founding_year: 2016 },
  { name: "Globant", tagline: "Digital transformation company.", city: "Buenos Aires", country: "Argentina", industry: "SaaS", logo: "https://logo.clearbit.com/globant.com", lat: -34.5950, lng: -58.3900, founder_quote: "Creating software that powers business reinvention.", founding_year: 2003 },
  { name: "Cornershop", tagline: "On-demand grocery delivery.", city: "Santiago", country: "Chile", industry: "Consumer", logo: "https://logo.clearbit.com/cornershopapp.com", lat: -33.4489, lng: -70.6693, founder_quote: "Making groceries simple in Latin America.", founding_year: 2015 },
  { name: "NotCo", tagline: "AI-powered plant-based food.", city: "Santiago", country: "Chile", industry: "Climate", logo: "https://logo.clearbit.com/notco.com", lat: -33.4400, lng: -70.6600, founder_quote: "Reinventing food with AI.", founding_year: 2015 },

  // ═══════════════════════════════════════════════════
  // EUROPE - UK & IRELAND
  // ═══════════════════════════════════════════════════
  { name: "Revolut", tagline: "One app, all things money.", city: "London", country: "UK", industry: "Fintech", logo: "https://logo.clearbit.com/revolut.com", lat: 51.5074, lng: -0.1278, founder_quote: "Building the world's first financial super app.", founding_year: 2015 },
  { name: "Wise", tagline: "Money without borders.", city: "London", country: "UK", industry: "Fintech", logo: "https://logo.clearbit.com/wise.com", lat: 51.5100, lng: -0.1300, founder_quote: "Sending money abroad should cost nothing.", founding_year: 2011 },
  { name: "Checkout.com", tagline: "The connected payments platform.", city: "London", country: "UK", industry: "Fintech", logo: "https://logo.clearbit.com/checkout.com", lat: 51.5150, lng: -0.1200, founder_quote: "Building tech that powers the digital economy.", founding_year: 2012 },
  { name: "Monzo", tagline: "Banking made easy.", city: "London", country: "UK", industry: "Fintech", logo: "https://logo.clearbit.com/monzo.com", lat: 51.5200, lng: -0.1350, founder_quote: "Making money work for everyone.", founding_year: 2015 },
  { name: "DeepMind", tagline: "Solving intelligence to advance humanity.", city: "London", country: "UK", industry: "AI", logo: "https://logo.clearbit.com/deepmind.com", lat: 51.5300, lng: -0.1250, founder_quote: "Solving intelligence, then using it to solve everything else.", founding_year: 2010 },
  { name: "Stability AI", tagline: "AI by the people, for the people.", city: "London", country: "UK", industry: "AI", logo: "https://logo.clearbit.com/stability.ai", lat: 51.5250, lng: -0.1180, founder_quote: "Building the foundation for open AI.", founding_year: 2019 },
  { name: "Deliveroo", tagline: "Your favourite food, delivered.", city: "London", country: "UK", industry: "Consumer", logo: "https://logo.clearbit.com/deliveroo.com", lat: 51.5350, lng: -0.1400, founder_quote: "Hyperlocal logistics at its finest.", founding_year: 2013 },
  { name: "Darktrace", tagline: "Self-learning AI for cyber defense.", city: "Cambridge", country: "UK", industry: "AI", logo: "https://logo.clearbit.com/darktrace.com", lat: 52.2053, lng: 0.1218, founder_quote: "AI that fights back against cyber threats.", founding_year: 2013 },
  { name: "Intercom", tagline: "The complete AI-first customer service.", city: "Dublin", country: "Ireland", industry: "SaaS", logo: "https://logo.clearbit.com/intercom.com", lat: 53.3400, lng: -6.2700, founder_quote: "Making internet business personal.", founding_year: 2011 },

  // EUROPE - France
  { name: "Mistral AI", tagline: "Frontier AI in your hands.", city: "Paris", country: "France", industry: "AI", logo: "https://logo.clearbit.com/mistral.ai", lat: 48.8566, lng: 2.3522, founder_quote: "Open weights are the future of AI.", founding_year: 2023 },
  { name: "BlaBlaCar", tagline: "Connecting people who travel together.", city: "Paris", country: "France", industry: "Consumer", logo: "https://logo.clearbit.com/blablacar.com", lat: 48.8600, lng: 2.3400, founder_quote: "Sharing rides, sharing stories.", founding_year: 2006 },
  { name: "Back Market", tagline: "Leading marketplace for refurbished electronics.", city: "Paris", country: "France", industry: "Consumer", logo: "https://logo.clearbit.com/backmarket.com", lat: 48.8650, lng: 2.3600, founder_quote: "Making refurbished the new standard.", founding_year: 2014 },
  { name: "Sorare", tagline: "The global fantasy football game.", city: "Paris", country: "France", industry: "Consumer", logo: "https://logo.clearbit.com/sorare.com", lat: 48.8500, lng: 2.3450, founder_quote: "Connecting sports fans through digital collectibles.", founding_year: 2018 },
  { name: "Doctolib", tagline: "Healthcare made easy.", city: "Paris", country: "France", industry: "Health", logo: "https://logo.clearbit.com/doctolib.fr", lat: 48.8700, lng: 2.3550, founder_quote: "Making healthcare accessible for everyone.", founding_year: 2013 },
  { name: "Dataiku", tagline: "Everyday AI, extraordinary results.", city: "Paris", country: "France", industry: "AI", logo: "https://logo.clearbit.com/dataiku.com", lat: 48.8530, lng: 2.3480, founder_quote: "Democratizing AI for every enterprise.", founding_year: 2013 },

  // EUROPE - Germany
  { name: "DeepL", tagline: "The world's most accurate translator.", city: "Cologne", country: "Germany", industry: "AI", logo: "https://logo.clearbit.com/deepl.com", lat: 50.9375, lng: 6.9603, founder_quote: "Language barriers should be a thing of the past.", founding_year: 2017 },
  { name: "N26", tagline: "The mobile bank.", city: "Berlin", country: "Germany", industry: "Fintech", logo: "https://logo.clearbit.com/n26.com", lat: 52.5200, lng: 13.4050, founder_quote: "Building the bank the world loves to use.", founding_year: 2013 },
  { name: "Trade Republic", tagline: "The future of mobile investing.", city: "Berlin", country: "Germany", industry: "Fintech", logo: "https://logo.clearbit.com/traderepublic.com", lat: 52.5250, lng: 13.4100, founder_quote: "Democratizing access to capital markets.", founding_year: 2015 },
  { name: "Celonis", tagline: "The global leader in execution management.", city: "Munich", country: "Germany", industry: "SaaS", logo: "https://logo.clearbit.com/celonis.com", lat: 48.1351, lng: 11.5820, founder_quote: "Unlocking value in your business processes.", founding_year: 2011 },
  { name: "Personio", tagline: "The HR operating system for SMEs.", city: "Munich", country: "Germany", industry: "SaaS", logo: "https://logo.clearbit.com/personio.com", lat: 48.1400, lng: 11.5870, founder_quote: "Enabling better organizations through HR.", founding_year: 2015 },
  { name: "FlixBus", tagline: "Travel across Europe by bus.", city: "Munich", country: "Germany", industry: "Consumer", logo: "https://logo.clearbit.com/flixbus.com", lat: 48.1300, lng: 11.5750, founder_quote: "Smart mobility for everyone.", founding_year: 2013 },
  { name: "Zalando", tagline: "Europe's leading online fashion platform.", city: "Berlin", country: "Germany", industry: "Consumer", logo: "https://logo.clearbit.com/zalando.com", lat: 52.5300, lng: 13.4150, founder_quote: "Reimagining fashion for the good of all.", founding_year: 2008 },
  { name: "Delivery Hero", tagline: "Always delivering amazing experiences.", city: "Berlin", country: "Germany", industry: "Consumer", logo: "https://logo.clearbit.com/deliveryhero.com", lat: 52.5150, lng: 13.3900, founder_quote: "Delivering moments that matter.", founding_year: 2011 },

  // EUROPE - Nordic
  { name: "Spotify", tagline: "Music for everyone.", city: "Stockholm", country: "Sweden", industry: "Consumer", logo: "https://logo.clearbit.com/spotify.com", lat: 59.3293, lng: 18.0686, founder_quote: "Unlocking the potential of human creativity.", founding_year: 2006 },
  { name: "Klarna", tagline: "Smoooth payments.", city: "Stockholm", country: "Sweden", industry: "Fintech", logo: "https://logo.clearbit.com/klarna.com", lat: 59.3350, lng: 18.0750, founder_quote: "We want to make shopping smoooth.", founding_year: 2005 },
  { name: "Northvolt", tagline: "Building the world's greenest battery.", city: "Stockholm", country: "Sweden", industry: "Climate", logo: "https://logo.clearbit.com/northvolt.com", lat: 59.3400, lng: 18.0600, founder_quote: "Powering the transition to clean energy.", founding_year: 2016 },
  { name: "Einride", tagline: "The future of freight.", city: "Stockholm", country: "Sweden", industry: "Climate", logo: "https://logo.clearbit.com/einride.tech", lat: 59.3200, lng: 18.0800, founder_quote: "Transforming how the world moves goods.", founding_year: 2016 },
  { name: "Bolt", tagline: "The future of urban transport.", city: "Tallinn", country: "Estonia", industry: "Consumer", logo: "https://logo.clearbit.com/bolt.eu", lat: 59.4370, lng: 24.7536, founder_quote: "Building cities for people, not cars.", founding_year: 2013 },
  { name: "Wolt", tagline: "Delivering amazing.", city: "Helsinki", country: "Finland", industry: "Consumer", logo: "https://logo.clearbit.com/wolt.com", lat: 60.1699, lng: 24.9384, founder_quote: "Making cities better places to live.", founding_year: 2014 },
  { name: "Vipps MobilePay", tagline: "Mobile payments for the Nordics.", city: "Oslo", country: "Norway", industry: "Fintech", logo: "https://logo.clearbit.com/vipps.no", lat: 59.9139, lng: 10.7522, founder_quote: "Making payments as easy as sending a text.", founding_year: 2015 },

  // EUROPE - Netherlands & Belgium
  { name: "Adyen", tagline: "Payments for the world's leading companies.", city: "Amsterdam", country: "Netherlands", industry: "Fintech", logo: "https://logo.clearbit.com/adyen.com", lat: 52.3676, lng: 4.9041, founder_quote: "We focus on building for the long term.", founding_year: 2006 },
  { name: "Booking.com", tagline: "The world's #1 accommodation site.", city: "Amsterdam", country: "Netherlands", industry: "Consumer", logo: "https://logo.clearbit.com/booking.com", lat: 52.3750, lng: 4.8900, founder_quote: "Making it easier to experience the world.", founding_year: 1996 },
  { name: "Mollie", tagline: "Effortless payments.", city: "Amsterdam", country: "Netherlands", industry: "Fintech", logo: "https://logo.clearbit.com/mollie.com", lat: 52.3700, lng: 4.9100, founder_quote: "Simplifying financial services for all businesses.", founding_year: 2004 },
  { name: "Collibra", tagline: "Data intelligence for the modern enterprise.", city: "Brussels", country: "Belgium", industry: "SaaS", logo: "https://logo.clearbit.com/collibra.com", lat: 50.8503, lng: 4.3517, founder_quote: "Every organization needs trusted data.", founding_year: 2008 },

  // EUROPE - Southern & Eastern
  { name: "Glovo", tagline: "Anything delivered in minutes.", city: "Barcelona", country: "Spain", industry: "Consumer", logo: "https://logo.clearbit.com/glovoapp.com", lat: 41.3874, lng: 2.1686, founder_quote: "Getting anything to anyone in minutes.", founding_year: 2015 },
  { name: "Cabify", tagline: "Move freely.", city: "Madrid", country: "Spain", industry: "Consumer", logo: "https://logo.clearbit.com/cabify.com", lat: 40.4168, lng: -3.7038, founder_quote: "Sustainable mobility for cities.", founding_year: 2011 },
  { name: "Satispay", tagline: "The smartest way to pay.", city: "Milan", country: "Italy", industry: "Fintech", logo: "https://logo.clearbit.com/satispay.com", lat: 45.4642, lng: 9.1900, founder_quote: "Reinventing everyday payments.", founding_year: 2013 },
  { name: "Scalapay", tagline: "Buy now, pay later in Europe.", city: "Milan", country: "Italy", industry: "Fintech", logo: "https://logo.clearbit.com/scalapay.com", lat: 45.4700, lng: 9.1800, founder_quote: "Flexible payments for everyone.", founding_year: 2019 },
  { name: "JetBrains", tagline: "Developer tools for professionals.", city: "Prague", country: "Czech Republic", industry: "SaaS", logo: "https://logo.clearbit.com/jetbrains.com", lat: 50.0755, lng: 14.4378, founder_quote: "We make the world's best developer tools.", founding_year: 2000 },
  { name: "InPost", tagline: "Parcel lockers across Europe.", city: "Krakow", country: "Poland", industry: "Consumer", logo: "https://logo.clearbit.com/inpost.pl", lat: 50.0647, lng: 19.9450, founder_quote: "Redefining last-mile delivery.", founding_year: 1999 },

  // EUROPE - Switzerland & Austria
  { name: "Climeworks", tagline: "Capturing CO2 from air.", city: "Zurich", country: "Switzerland", industry: "Climate", logo: "https://logo.clearbit.com/climeworks.com", lat: 47.3769, lng: 8.5417, founder_quote: "Direct air capture for a net-zero future.", founding_year: 2009 },
  { name: "On Running", tagline: "Running shoes engineered in Switzerland.", city: "Zurich", country: "Switzerland", industry: "Consumer", logo: "https://logo.clearbit.com/on.com", lat: 47.3800, lng: 8.5500, founder_quote: "Making running feel like running on clouds.", founding_year: 2010 },
  { name: "Mindbreeze", tagline: "AI-powered enterprise search.", city: "Linz", country: "Austria", industry: "AI", logo: "https://logo.clearbit.com/mindbreeze.com", lat: 48.3069, lng: 14.2858, founder_quote: "Insight-driven enterprise intelligence.", founding_year: 2005 },

  // ═══════════════════════════════════════════════════
  // MIDDLE EAST
  // ═══════════════════════════════════════════════════
  { name: "Careem", tagline: "Simplifying lives in the Middle East.", city: "Dubai", country: "UAE", industry: "Consumer", logo: "https://logo.clearbit.com/careem.com", lat: 25.2048, lng: 55.2708, founder_quote: "We exist to simplify lives.", founding_year: 2012 },
  { name: "Tabby", tagline: "Buy now, pay later in MENA.", city: "Dubai", country: "UAE", industry: "Fintech", logo: "https://logo.clearbit.com/tabby.ai", lat: 25.1972, lng: 55.2796, founder_quote: "Financial freedom across the region.", founding_year: 2019 },
  { name: "Kitopi", tagline: "The world's leading cloud kitchen.", city: "Dubai", country: "UAE", industry: "Consumer", logo: "https://logo.clearbit.com/kitopi.com", lat: 25.2100, lng: 55.2600, founder_quote: "Powering restaurant growth through tech.", founding_year: 2018 },
  { name: "Fawry", tagline: "Egypt's leading fintech.", city: "Cairo", country: "Egypt", industry: "Fintech", logo: "https://logo.clearbit.com/fawry.com", lat: 30.0444, lng: 31.2357, founder_quote: "Digital payments for every Egyptian.", founding_year: 2008 },
  { name: "Halan", tagline: "Ride-hailing and fintech for Egypt.", city: "Cairo", country: "Egypt", industry: "Consumer", logo: "https://logo.clearbit.com/halan.com", lat: 30.0500, lng: 31.2400, founder_quote: "Empowering the underserved.", founding_year: 2017 },
  { name: "Wiz", tagline: "Cloud security made simple.", city: "Tel Aviv", country: "Israel", industry: "SaaS", logo: "https://logo.clearbit.com/wiz.io", lat: 32.0853, lng: 34.7818, founder_quote: "Securing everything you build and run in the cloud.", founding_year: 2020 },
  { name: "Monday.com", tagline: "Work management platform.", city: "Tel Aviv", country: "Israel", industry: "SaaS", logo: "https://logo.clearbit.com/monday.com", lat: 32.0900, lng: 34.7750, founder_quote: "Making work human-centered.", founding_year: 2012 },
  { name: "Mobileye", tagline: "Autonomous driving technology.", city: "Jerusalem", country: "Israel", industry: "AI", logo: "https://logo.clearbit.com/mobileye.com", lat: 31.7683, lng: 35.2137, founder_quote: "Driving the autonomous revolution.", founding_year: 1999 },
  { name: "Papaya Global", tagline: "Global payroll and workforce management.", city: "Tel Aviv", country: "Israel", industry: "SaaS", logo: "https://logo.clearbit.com/papayaglobal.com", lat: 32.0800, lng: 34.7900, founder_quote: "Making global workforce management effortless.", founding_year: 2016 },

  // ═══════════════════════════════════════════════════
  // AFRICA
  // ═══════════════════════════════════════════════════
  { name: "Flutterwave", tagline: "Payments infrastructure across Africa.", city: "Lagos", country: "Nigeria", industry: "Fintech", logo: "https://logo.clearbit.com/flutterwave.com", lat: 6.5244, lng: 3.3792, founder_quote: "Connecting Africa to the global economy.", founding_year: 2016 },
  { name: "Andela", tagline: "Connecting global talent to opportunity.", city: "Lagos", country: "Nigeria", industry: "SaaS", logo: "https://logo.clearbit.com/andela.com", lat: 6.4698, lng: 3.5852, founder_quote: "Brilliant people are everywhere.", founding_year: 2014 },
  { name: "Paystack", tagline: "Simple payments for Africa.", city: "Lagos", country: "Nigeria", industry: "Fintech", logo: "https://logo.clearbit.com/paystack.com", lat: 6.5300, lng: 3.3900, founder_quote: "Accelerating payments across Africa.", founding_year: 2015 },
  { name: "Interswitch", tagline: "Connecting communities across Africa.", city: "Lagos", country: "Nigeria", industry: "Fintech", logo: "https://logo.clearbit.com/interswitchgroup.com", lat: 6.5150, lng: 3.3700, founder_quote: "Transforming payment systems on the continent.", founding_year: 2002 },
  { name: "M-Pesa", tagline: "Mobile money for everyone.", city: "Nairobi", country: "Kenya", industry: "Fintech", logo: "https://logo.clearbit.com/safaricom.co.ke", lat: -1.2921, lng: 36.8219, founder_quote: "Financial inclusion starts with a phone.", founding_year: 2007 },
  { name: "Chipper Cash", tagline: "Send money across Africa for free.", city: "Nairobi", country: "Kenya", industry: "Fintech", logo: "https://logo.clearbit.com/chippercash.com", lat: -1.2850, lng: 36.8300, founder_quote: "Cross-border payments without fees.", founding_year: 2018 },
  { name: "Jumia", tagline: "Africa's leading e-commerce platform.", city: "Lagos", country: "Nigeria", industry: "Consumer", logo: "https://logo.clearbit.com/jumia.com", lat: 6.5000, lng: 3.3600, founder_quote: "E-commerce for Africa powered by technology.", founding_year: 2012 },
  { name: "Yoco", tagline: "Card payments for small business.", city: "Cape Town", country: "South Africa", industry: "Fintech", logo: "https://logo.clearbit.com/yoco.com", lat: -33.9249, lng: 18.4241, founder_quote: "Enabling SMBs across Africa.", founding_year: 2013 },
  { name: "TymeBank", tagline: "Digital banking for South Africa.", city: "Johannesburg", country: "South Africa", industry: "Fintech", logo: "https://logo.clearbit.com/tymebank.co.za", lat: -26.2041, lng: 28.0473, founder_quote: "Banking that works for real people.", founding_year: 2018 },
  { name: "Wave", tagline: "Mobile money for Africa.", city: "Dakar", country: "Senegal", industry: "Fintech", logo: "https://logo.clearbit.com/wave.com", lat: 14.7167, lng: -17.4677, founder_quote: "Making financial services accessible to all Africans.", founding_year: 2018 },
  { name: "Moove", tagline: "Mobility fintech for Africa.", city: "Lagos", country: "Nigeria", industry: "Fintech", logo: "https://logo.clearbit.com/moove.io", lat: 6.5400, lng: 3.4000, founder_quote: "Democratizing vehicle ownership across Africa.", founding_year: 2020 },

  // ═══════════════════════════════════════════════════
  // INDIA & SOUTH ASIA
  // ═══════════════════════════════════════════════════
  { name: "Razorpay", tagline: "The future of payments in India.", city: "Bangalore", country: "India", industry: "Fintech", logo: "https://logo.clearbit.com/razorpay.com", lat: 12.9716, lng: 77.5946, founder_quote: "Digitizing the Indian economy.", founding_year: 2014 },
  { name: "Zomato", tagline: "Better food for more people.", city: "Gurgaon", country: "India", industry: "Consumer", logo: "https://logo.clearbit.com/zomato.com", lat: 28.4595, lng: 77.0266, founder_quote: "Building the future of food delivery.", founding_year: 2008 },
  { name: "CRED", tagline: "The privileged way to manage credit.", city: "Bangalore", country: "India", industry: "Fintech", logo: "https://logo.clearbit.com/cred.club", lat: 12.9352, lng: 77.6245, founder_quote: "Building a community of responsible credit users.", founding_year: 2018 },
  { name: "Paytm", tagline: "India's largest digital payments.", city: "Noida", country: "India", industry: "Fintech", logo: "https://logo.clearbit.com/paytm.com", lat: 28.5355, lng: 77.3910, founder_quote: "Bringing half a billion Indians into the mainstream economy.", founding_year: 2010 },
  { name: "Ola", tagline: "Moving the world.", city: "Bangalore", country: "India", industry: "Consumer", logo: "https://logo.clearbit.com/olacabs.com", lat: 12.9800, lng: 77.6000, founder_quote: "Building a sustainable future for mobility.", founding_year: 2010 },
  { name: "Byju's", tagline: "Fall in love with learning.", city: "Bangalore", country: "India", industry: "SaaS", logo: "https://logo.clearbit.com/byjus.com", lat: 12.9600, lng: 77.5850, founder_quote: "Making learning visual and engaging.", founding_year: 2011 },
  { name: "Zerodha", tagline: "India's largest stock broker.", city: "Bangalore", country: "India", industry: "Fintech", logo: "https://logo.clearbit.com/zerodha.com", lat: 12.9500, lng: 77.6100, founder_quote: "Democratizing investing in India.", founding_year: 2010 },
  { name: "Freshworks", tagline: "Easy-to-use business software.", city: "Chennai", country: "India", industry: "SaaS", logo: "https://logo.clearbit.com/freshworks.com", lat: 13.0827, lng: 80.2707, founder_quote: "Making it fast and easy for businesses to delight customers.", founding_year: 2010 },
  { name: "PhonePe", tagline: "India's leading digital payments app.", city: "Bangalore", country: "India", industry: "Fintech", logo: "https://logo.clearbit.com/phonepe.com", lat: 12.9900, lng: 77.5750, founder_quote: "Digital payments for every Indian.", founding_year: 2015 },
  { name: "Swiggy", tagline: "Delivering food, instantly.", city: "Bangalore", country: "India", industry: "Consumer", logo: "https://logo.clearbit.com/swiggy.com", lat: 13.0000, lng: 77.6200, founder_quote: "Changing the way India eats.", founding_year: 2014 },
  { name: "Meesho", tagline: "Social commerce for India.", city: "Bangalore", country: "India", industry: "Consumer", logo: "https://logo.clearbit.com/meesho.com", lat: 12.9400, lng: 77.5800, founder_quote: "Enabling millions to start online businesses.", founding_year: 2015 },
  { name: "Lenskart", tagline: "India's biggest eyewear brand.", city: "Delhi", country: "India", industry: "Consumer", logo: "https://logo.clearbit.com/lenskart.com", lat: 28.6139, lng: 77.2090, founder_quote: "Vision for every Indian.", founding_year: 2010 },
  { name: "Pine Labs", tagline: "Merchant technology platform.", city: "Noida", country: "India", industry: "Fintech", logo: "https://logo.clearbit.com/pinelabs.com", lat: 28.5400, lng: 77.4000, founder_quote: "Powering digital commerce in Asia.", founding_year: 1998 },
  { name: "Nykaa", tagline: "Beauty begins here.", city: "Mumbai", country: "India", industry: "Consumer", logo: "https://logo.clearbit.com/nykaa.com", lat: 19.0760, lng: 72.8777, founder_quote: "Redefining beauty in India.", founding_year: 2012 },
  { name: "bKash", tagline: "Mobile financial services for Bangladesh.", city: "Dhaka", country: "Bangladesh", industry: "Fintech", logo: "https://logo.clearbit.com/bkash.com", lat: 23.8103, lng: 90.4125, founder_quote: "Financial inclusion for 170 million people.", founding_year: 2011 },

  // ═══════════════════════════════════════════════════
  // EAST ASIA
  // ═══════════════════════════════════════════════════
  // China
  { name: "ByteDance", tagline: "Inspire creativity, enrich life.", city: "Beijing", country: "China", industry: "Consumer", logo: "https://logo.clearbit.com/bytedance.com", lat: 39.9042, lng: 116.4074, founder_quote: "Technology empowers creativity.", founding_year: 2012 },
  { name: "Alibaba", tagline: "To make it easy to do business anywhere.", city: "Hangzhou", country: "China", industry: "Consumer", logo: "https://logo.clearbit.com/alibaba.com", lat: 30.2741, lng: 120.1551, founder_quote: "Customers first, employees second.", founding_year: 1999 },
  { name: "Tencent", tagline: "Value for users, tech for good.", city: "Shenzhen", country: "China", industry: "Consumer", logo: "https://logo.clearbit.com/tencent.com", lat: 22.5431, lng: 114.0579, founder_quote: "Technology for social good.", founding_year: 1998 },
  { name: "Xiaomi", tagline: "Innovation for everyone.", city: "Beijing", country: "China", industry: "Consumer", logo: "https://logo.clearbit.com/mi.com", lat: 39.9150, lng: 116.4200, founder_quote: "Quality tech at honest prices.", founding_year: 2010 },
  { name: "DJI", tagline: "The future of possible.", city: "Shenzhen", country: "China", industry: "Consumer", logo: "https://logo.clearbit.com/dji.com", lat: 22.5500, lng: 114.0650, founder_quote: "Making drones accessible to all.", founding_year: 2006 },
  { name: "NIO", tagline: "Blue sky coming.", city: "Shanghai", country: "China", industry: "Climate", logo: "https://logo.clearbit.com/nio.com", lat: 31.2304, lng: 121.4737, founder_quote: "A better, more sustainable future.", founding_year: 2014 },
  { name: "BYD", tagline: "Build your dreams.", city: "Shenzhen", country: "China", industry: "Climate", logo: "https://logo.clearbit.com/byd.com", lat: 22.5350, lng: 114.0500, founder_quote: "Cool the earth by one degree.", founding_year: 1995 },
  { name: "SenseTime", tagline: "AI for a better life.", city: "Hong Kong", country: "China", industry: "AI", logo: "https://logo.clearbit.com/sensetime.com", lat: 22.3193, lng: 114.1694, founder_quote: "Using AI to solve real-world problems.", founding_year: 2014 },

  // Japan
  { name: "Mercari", tagline: "The marketplace app.", city: "Tokyo", country: "Japan", industry: "Consumer", logo: "https://logo.clearbit.com/mercari.com", lat: 35.6762, lng: 139.6503, founder_quote: "Creating value in a circular economy.", founding_year: 2013 },
  { name: "SmartNews", tagline: "Discover the News that matters.", city: "Tokyo", country: "Japan", industry: "Consumer", logo: "https://logo.clearbit.com/smartnews.com", lat: 35.6850, lng: 139.6600, founder_quote: "Quality news accessible to everyone.", founding_year: 2012 },
  { name: "PayPay", tagline: "Cashless payments for Japan.", city: "Tokyo", country: "Japan", industry: "Fintech", logo: "https://logo.clearbit.com/paypay.ne.jp", lat: 35.6700, lng: 139.6400, founder_quote: "Making Japan cashless.", founding_year: 2018 },
  { name: "Preferred Networks", tagline: "Deep learning for the real world.", city: "Tokyo", country: "Japan", industry: "AI", logo: "https://logo.clearbit.com/preferred.jp", lat: 35.6900, lng: 139.7000, founder_quote: "Solving with deep learning what was unsolvable.", founding_year: 2014 },

  // South Korea
  { name: "Kakao", tagline: "Connecting people through technology.", city: "Seongnam", country: "South Korea", industry: "Consumer", logo: "https://logo.clearbit.com/kakao.com", lat: 37.3219, lng: 127.1111, founder_quote: "Making everyday life better.", founding_year: 2010 },
  { name: "Coupang", tagline: "Wow the customer.", city: "Seoul", country: "South Korea", industry: "Consumer", logo: "https://logo.clearbit.com/coupang.com", lat: 37.5665, lng: 126.9780, founder_quote: "Rocket delivery, rocket speed.", founding_year: 2010 },
  { name: "Toss", tagline: "Financial super app.", city: "Seoul", country: "South Korea", industry: "Fintech", logo: "https://logo.clearbit.com/toss.im", lat: 37.5600, lng: 126.9850, founder_quote: "Making finance simple for everyone.", founding_year: 2013 },
  { name: "Krafton", tagline: "Global gaming company.", city: "Seoul", country: "South Korea", industry: "Consumer", logo: "https://logo.clearbit.com/krafton.com", lat: 37.5700, lng: 126.9700, founder_quote: "Games that bring the world together.", founding_year: 2007 },

  // ═══════════════════════════════════════════════════
  // SOUTHEAST ASIA
  // ═══════════════════════════════════════════════════
  { name: "Grab", tagline: "The everyday everything app.", city: "Singapore", country: "Singapore", industry: "Consumer", logo: "https://logo.clearbit.com/grab.com", lat: 1.3521, lng: 103.8198, founder_quote: "Driving Southeast Asia forward.", founding_year: 2012 },
  { name: "Sea Group", tagline: "Digital ecosystem for SE Asia.", city: "Singapore", country: "Singapore", industry: "Consumer", logo: "https://logo.clearbit.com/sea.com", lat: 1.2966, lng: 103.7764, founder_quote: "Digital ecosystems serving a global community.", founding_year: 2009 },
  { name: "Gojek", tagline: "Flow with Gojek.", city: "Jakarta", country: "Indonesia", industry: "Consumer", logo: "https://logo.clearbit.com/gojek.com", lat: -6.2088, lng: 106.8456, founder_quote: "Solving daily friction with technology.", founding_year: 2010 },
  { name: "Tokopedia", tagline: "Start and discover your needs.", city: "Jakarta", country: "Indonesia", industry: "Consumer", logo: "https://logo.clearbit.com/tokopedia.com", lat: -6.2000, lng: 106.8500, founder_quote: "Democratizing commerce through technology.", founding_year: 2009 },
  { name: "Bukalapak", tagline: "Indonesian e-commerce for everyone.", city: "Jakarta", country: "Indonesia", industry: "Consumer", logo: "https://logo.clearbit.com/bukalapak.com", lat: -6.2150, lng: 106.8400, founder_quote: "Fair economy for all through technology.", founding_year: 2010 },
  { name: "Lazada", tagline: "Shop the world.", city: "Singapore", country: "Singapore", industry: "Consumer", logo: "https://logo.clearbit.com/lazada.com", lat: 1.3600, lng: 103.8300, founder_quote: "Making Southeast Asia shop smarter.", founding_year: 2012 },
  { name: "Traveloka", tagline: "Your lifestyle super app.", city: "Jakarta", country: "Indonesia", industry: "Consumer", logo: "https://logo.clearbit.com/traveloka.com", lat: -6.1950, lng: 106.8350, founder_quote: "Technology-driven exploration.", founding_year: 2012 },
  { name: "VNPay", tagline: "Vietnam's leading digital payments.", city: "Hanoi", country: "Vietnam", industry: "Fintech", logo: "https://logo.clearbit.com/vnpay.vn", lat: 21.0278, lng: 105.8342, founder_quote: "Cashless society for Vietnam.", founding_year: 2007 },
  { name: "GCash", tagline: "Philippines' #1 finance super app.", city: "Manila", country: "Philippines", industry: "Fintech", logo: "https://logo.clearbit.com/gcash.com", lat: 14.5995, lng: 120.9842, founder_quote: "Finance for every Filipino.", founding_year: 2004 },
  { name: "GoTo", tagline: "Indonesia's leading tech ecosystem.", city: "Jakarta", country: "Indonesia", industry: "Consumer", logo: "https://logo.clearbit.com/gotocompany.com", lat: -6.2250, lng: 106.8550, founder_quote: "Tech for progress.", founding_year: 2021 },

  // ═══════════════════════════════════════════════════
  // OCEANIA
  // ═══════════════════════════════════════════════════
  { name: "Canva", tagline: "Empowering the world to design.", city: "Sydney", country: "Australia", industry: "SaaS", logo: "https://logo.clearbit.com/canva.com", lat: -33.8688, lng: 151.2093, founder_quote: "Design should be accessible to everyone.", founding_year: 2013 },
  { name: "Atlassian", tagline: "Collaboration software for teams.", city: "Sydney", country: "Australia", industry: "SaaS", logo: "https://logo.clearbit.com/atlassian.com", lat: -33.9150, lng: 151.2300, founder_quote: "Software that teams actually want to use.", founding_year: 2002 },
  { name: "Afterpay", tagline: "Buy now, pay later.", city: "Melbourne", country: "Australia", industry: "Fintech", logo: "https://logo.clearbit.com/afterpay.com", lat: -37.8136, lng: 144.9631, founder_quote: "Changing the way you pay.", founding_year: 2014 },
  { name: "SafetyCulture", tagline: "A distributed workplace app.", city: "Sydney", country: "Australia", industry: "SaaS", logo: "https://logo.clearbit.com/safetyculture.com", lat: -33.8800, lng: 151.2200, founder_quote: "Helping teams get better every day.", founding_year: 2004 },
  { name: "Xero", tagline: "Beautiful business accounting.", city: "Wellington", country: "New Zealand", industry: "SaaS", logo: "https://logo.clearbit.com/xero.com", lat: -41.2865, lng: 174.7762, founder_quote: "Making life better for small business.", founding_year: 2006 },
  { name: "Rocket Lab", tagline: "End-to-end space company.", city: "Auckland", country: "New Zealand", industry: "Climate", logo: "https://logo.clearbit.com/rocketlabusa.com", lat: -36.8485, lng: 174.7633, founder_quote: "Opening access to space to improve life on Earth.", founding_year: 2006 },

  // ═══════════════════════════════════════════════════
  // CENTRAL ASIA & RUSSIA
  // ═══════════════════════════════════════════════════
  { name: "Kaspi.kz", tagline: "Kazakhstan's super app.", city: "Almaty", country: "Kazakhstan", industry: "Fintech", logo: "https://logo.clearbit.com/kaspi.kz", lat: 43.2220, lng: 76.8512, founder_quote: "Everything you need in one app.", founding_year: 2002 },
  { name: "Yandex", tagline: "Technology company for search & more.", city: "Moscow", country: "Russia", industry: "AI", logo: "https://logo.clearbit.com/yandex.com", lat: 55.7558, lng: 37.6173, founder_quote: "Technology that serves people.", founding_year: 1997 },
  { name: "Wildberries", tagline: "Russia's largest online retailer.", city: "Moscow", country: "Russia", industry: "Consumer", logo: "https://logo.clearbit.com/wildberries.ru", lat: 55.7600, lng: 37.6250, founder_quote: "Making shopping accessible to everyone.", founding_year: 2004 },
  { name: "InDrive", tagline: "Ride-hailing where you set the price.", city: "Astana", country: "Kazakhstan", industry: "Consumer", logo: "https://logo.clearbit.com/indrive.com", lat: 51.1605, lng: 71.4704, founder_quote: "Fair prices decided by people, not algorithms.", founding_year: 2012 },
];

export const FALLBACK_STARTUPS: Startup[] = dedupeStartups(_RAW_STARTUPS);
