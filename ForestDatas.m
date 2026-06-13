function [ ForestVec ] = ForestDatas()

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% DATA FOR CARBON NANOTUBE FORESTS, SOURCED FROM REVIEW BY RAKOV:		  %
% "MATERIALS MADE FROM CARBON NANOTUBES: THE CARBON NANOTUBE FOREST"	  %
% (2013). Also data from A. John Hart since 2013 and Michael De Volder    %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

ForestVec = zeros(1000,7);

% ForestVec is [ Density (kg/m3), Strength (MPa), Stiffness (GPa), 
% Ductility (%), Energy to Failure (MJ/m^3), 
% Electrical Conductivity (s/cm), Thermal Conductivity (W/mk); 

% Qingjun Cai, Bing-chung Chen, Yuan Zhao, Julia Mack, Yanbao Ma,
% Chung-lung Chen, Hengzhi Wang, Zhifeng Ren.
% "Thermal property measurements of carbon nanotube forest
% synthesized by thermal CVD process". Proceedings of the ASME 2009 heat 
% transfer conference, July 19-23, 2009, California USA.

ForestVec(1,1) = 31;	ForestVec(1,7) = 0.95;

% Anyuan Cao, Pamela L. Dickrell, W. Gregory Sawyer, Mehrdad N. Ghasemi-Nejhad,
% Pulickel M. Ajayan. "Super-compressible foamlike carbon nanotube films". 
% Science, 310, (2005). pp. 1307-1310.

ForestVec(2,1) = 280;	ForestVec(2,2) = 12;	ForestVec(2,3) = 0.6;

% Christian P. Deck, Jason Flowers, Gregg S. B. McKee, Kenneth Vecchio. 
% "Mechanical behaviour of ultralong multiwalled carbon nanotube mats"
% Journal of Applied Physics, 101, 023512 (2007).

ForestVec(3,1) = 65;	ForestVec(3,2) = 14;	ForestVec(3,3) = 0.8;

% Michael De Volder, Sameh H. Tawfick, Sei Jin Park, Davor Copic, 
% Zhouzhou Zhao, Wei Lu, A. John Hart. "Diverse 3D Microarchitectures made
% by capillary forming of carbon nanotubes". Advanced Materials 22 (2010),
% pp. 4384-4389.

ForestVec(4,1) = 17;	ForestVec(4,2) = 0.18; 	ForestVec(4,3) = 0.054;
ForestVec(5,1) = 500;	ForestVec(5,2) = 16;	ForestVec(5,3) = 5;

% Michael De Volder, Sameh Tawfick, Sei Jin Park, A. John Hart.
% "Corrugated carbon nanotube microstructures with geometrically tunable
% compliance". ACS Nano, (2011), 5, 9, pp. 7310-7317.

ForestVec(6,1) = 270;							ForestVec(6,3) = 0.050;

% Michael De Volder, Sei Jin Park, Sameh H. Tawfick, Daniel O. Vidaud,
% A. John Hart. "Fabrication and electrical integration of robust carbon 
% nanotube electrodes"

ForestVec(7,1) = 31;	ForestVec(7,2) = 0.18;	ForestVec(7,3) = 0.00156;
ForestVec(7,6) = 0.04;
ForestVec(8,1) = 530;	ForestVec(8,2) = 18;	ForestVec(8,3) = 2.24;
ForestVec(8,4) = 103;

% Don N. Futaba, Kenji Hata, Takeo Yamada, Tatsuki Hiraoka, Yuhei Hayamizu,
% Yozo Kakudate, Osamu Tanaike, Hiroaki Hatori, Motoo Yumura, Sumio Iijima. 
% "Shape-engineerable and highly densely packed single-walled carbon nanotubes
% and their application as super-capacitor electrodes". Nature Materias, 5,
% (2006), pp. 987-994.

ForestVec(9,1)  = 29;	ForestVec(9,2)  = 0.327;
ForestVec(10,1) = 570;	ForestVec(10,2) = 27.8;
ForestVec(10,6) = 114;

% Yuhei Hayamizu, Takeo Yamada, Kohei Mizuno, Robert C. Davis, Don N. Futaba, 
% Motoo Yumura, Kenji Hata. "Integrated three-dimensional microelectromechanical
% devices from processable carbon nanotube wafers". Nature 3, (2008), pp. 289-294.

ForestVec(11,1) = 460;		ForestVec(11,3) = 9.7;

% Yuhei Hayamizu, Robert C. Davis, Takeo Yamada, Don N. Futaba, Satoshi Yusada,
% Motoo Yumura, Kenji Hata. "Mechanical properties of beams from self-assembled
% closely packed and aligned single-walled carbon nanotubes".

ForestVec(12,1)= 460;			ForestVec(12,3) = 47.0;

% Ilia Ivanov, Alexander Puretzky, Gyula Eres, Hsin Wang, Zhengwei Pan, Hongtao Cui,
% Rongying Jin, Jane Howe, David B. Geohegan. "Fast and highly anisotropic thermal
% transport through vertically aligned carbon nanotube arrays". Applied physics Letters
% 89 (2006) pp. 223110.

ForestVec(13,1) = 150;				ForestVec(13,7) = 15.3;

% Ludovica Lattanzi, Jordan R. Raney, Luigi De Nardo, Abha Misra, Chiara Daraio.
% "Nonlinear viscoelasticity of freestanding and polymer-anchored vertically
% aligned carbon nanotube foams". Journal of Applied Physics, 111, 074314 (2012)
% 074314

ForestVec(14,1) = 210;				ForestVec(14,3) = 0.01;

% Cheng-Te Lin, Chi-Young Lee, Tsung-Shune Chin, Rong Xiang, Kei Ishikawa,
% Junichiro Shiomi, Shigeo Maruyama. "Anisotropic electrical conduction of vertically-aligned
% single-walled carbon nanotube films". Carbon 49 (2011), pp. 1446-1452.

ForestVec(15,1) = 36;				ForestVec(15,6) = 5.6;

% Abha Misra, Julia R. Greer, Chiara Daraio. "Strain rate effects in the mechanical
% response of polymer-anchored carbon nanotube foams"
% Advanced Materials 21 (2009), pp. 334-338.

ForestVec(16,1) = 43.5;		ForestVec(16,2) = 4;	%ForestVec(16,3) = 2.1;
ForestVec(16,6) = 0.16;

% M. A. Panzer, G. Zhang, D. Mann, X. Hu, E. Pop, H. Dai, K. E. Goodson. 
% "Thermal Properties of Metal-Coated Vertically Aligned Single-Wall Nanotube Arrays"
% Journal of Heat Transfer (2008), vol. 130, pp. 052401.

ForestVec(17,1) = 264;		ForestVec(17,7) = 8;

% Siddhartha Pathak, Z. Goknur Cambaz, Surya R. Kalidindi, J. Gregory Swadener, 
% Yury Gogotsi. "Viscoelasticity and high buckling stress of dense carbon nanotube
% brushes". Carbon , 47 (2009), pp. 1969-1976.

ForestVec(18,1) = 950;		ForestVec(18,2) = 360;		ForestVec(18,3) = 18;	 

% Siddhartha Pathak, Ee J. Lim, Parisa Pour Shahid Saeed Abadi, Samuel Graham, 
% Baratunde A. Cola, Julia R. Greer. "Higher recovery and better energy dissapation
% at faster strain rates in carbon nanotube bundles: an in-situ study".
% ACS Nano, (2012), no. 3, vol. 6, pp. 2189-2197.

ForestVec(19,1) = 80;	ForestVec(19,2) = 3;		ForestVec(19,3) = 0.045;

% Siddhartha Pathak, Nisha Mohan, Elizabeth Decolvenaere, Alan Needleman, Mostafa Bedewy, 
% A. John Hart, Julia R. Greer. "Local relative density modulates failure and strength
% in vertically aligned carbon nanotubes". ACS Nano, vol. 7, No. 10, (2013), pp. 8593-8604.

ForestVec(20,1) = 80;	ForestVec(20,2) = 3;		ForestVec(20,3) = 0.177;

% A. Qiu, D. F. Bahr, A. A. Zbib, A. Bellou, S. Dj. Mesarovic, D. McClain, W. Hudson,
% J. Jiao, D. Kiener, M. J. Cordill. "Local and non-local behaviour and coordinated 
% buckling of CNT turfs". Carbon 49 (2011), pp. 1430-1438.

ForestVec(21,1) = 38.94; ForestVec(21,2) = 1;		ForestVec(21,3) = 0.055;

% J. Suhr, P. Victor, L. Ci, S. Sreekala, X. Zhang, O. Nalamasu, P. M. Ajayan.
% "Fatigue resistance of aligned carbon nanotube arrays under cyclic compression".
% Nature, 2, (2007), pp. 417-421.

ForestVec(22,1) = 220;	ForestVec(22,2) = 0.1;	ForestVec(22,3) = 0.026;
ForestVec(22,6) = 3.63;

% S. Tawfick, K. O'Brien, A. J. Hart. "Flexible high-conductivity carbon-nanotube
% interconnects made by rolling and printing". Small, no. 5, (2009), pp. 2467-2473.

ForestVec(23,1) = 1260;	ForestVec(23,6) = 660; 

% Tao Tong, Yang Zhao, Lance Delzeit, Ali Kashani, M. Meyyappan, Arun, Majumdar.
% "Dense vertically aligned multiwalled carbon nanotube arrays as thermal interface
% materials". IEEE transactions on components and packaging technologies, vol. 30,
% 1, (2007), pp. 92-100.

ForestVec(24,1) = 500;	ForestVec(24,7) = 250;

% Geza Toth, Jani Maklin, Niina Halonen, Jaako Palosaari, Jari Juuti, Heli Jantunen,
% Krisztian Kordas, W. Gregory Sawyer, Robert Vajtai, Pulickel M. Ajayan.
% "Carbon-nanotube-based electrical brush contacts"

ForestVec(25,1) = 300;	ForestVec(25,3) = 0.0024;

% Yuan Xu, Yi Zhang, Ephraim Suhir. "Thermal properties of carbon nanotube array used
% for integrated circuit cooling". Journal of Applied Physics 100, (2006), 074302.

ForestVec(26,1) = 185;	ForestVec(26,7) = 40.1;

% Onnik Yaglioglu, Anyuan Cao, A. John Hart, Rod Martens, A. H. Slocum. 
% "Wide range control of microstructure and mechanical properties of carbon 
% nanotube forests: a comparison between fixed and floating catalyst CVD techniques".
% Advanced Functional Materials 22, (2012), pp. 5028-5037.

ForestVec(27,1) = 8;	ForestVec(27,2) = 0.021;	ForestVec(27,3) = 0.00186;
ForestVec(28,1) = 15;	ForestVec(28,2) = 0.117;	ForestVec(28,3) = 0.00744;
ForestVec(29,1) = 200;	ForestVec(29,2) = 9.997;	ForestVec(29,3) = 0.1385;

% D. J. Yang, S. G. Wang, Q. Zhang, P. J. Sellin, G. Chen. 
% "Thermal and electrical transport in multi-walled carbon nanotubes"
% Physics Letters A 329 (2004), pp. 207-213.

ForestVec(30,1) = 165;	ForestVec(30,6) = 20;	ForestVec(30,7) = 15;

% Xiaojun Liang, Jungho Shin, Daniel Magagnosc, Yijie Jiang, Sei Jin Park, 
% A. John Hart, Kevin Turner, Daniel S. Gianola, Prashant K. Purohit.
% "Compression and recovery of carbon nanotube forests described as a phase
% transition". International Journal of Solids and Structures, Vol. 122-123
% (2017), pp. 196-209.

ForestVec(31,1) = 22;	ForestVec(31,2) = 1;	ForestVec(31,3) = 0.006;

% Assaf Ya'akobovitz, Mostafa Bedewy, Abhinav Rao, A. John Hart.
% "Strain relaxation and resonance of carbon nanotube forests under 
% electrostatic loading". Carbon 96 (2016), pp. 250-258.

ForestVec(32,1) = 15;	ForestVec(32,2) = 0.015;	ForestVec(32,3) = 0.00085;

% Anna Brieland-Shoultz, Sameh Tawfick, Sei Jin Park, Mostafa Bedewy, 
% Matthew R. Maschmann, Jeffery W. Baur, A. John Hart.
% "Scaling the stiffness, strength and toughness of ceramic-coated nanotube
% foams into the structural regime". Advanced Functional Materials 24, (2014),
% pp. 5728-5735.

ForestVec(33,1) = 6.6;	ForestVec(33,3) = 0.01;

% Matthew R. Maschmann, Gregory J. Ehlert, Sei Jin Park, David Mollenhauer, 
% Benji Maruyama, A. John Hart, Jeffery W. Bauer. "Visualizing strain evolution
% and coordinated buckling within CNT arrays by in situ digital image correlation"
% Advanced Functional Materials 22, (2012), pp. 4686-4695.

ForestVec(34,1) = 15; 	ForestVec(34,2) = 0.6;	ForestVec(34,3) = 0.012;

end