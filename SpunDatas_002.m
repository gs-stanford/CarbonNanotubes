function [SheetVec,YarnVec] = SpunDatas_002()

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% DATA FROM CARBON NANOTUBE SPUN MATERIALS: LIST OF PAPERS BY FIONA SMAIL %
% ALL OF THESE ARE FOR "WINDLE PROCESS" MATERIALS MADE BY FCCVD METHODS.  %  
% This section takes the original and splits it into yarns or sheets to   %
% enable differentiation. Full titles are given for each reference.	  	  %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

SheetVec = zeros(200,7);	YarnVec = zeros(100,7);

% Both SheetVec and YarnVec are [ Density (kg/m3), Strength (MPa), 
% Stiffness (GPa), Ductility (%), Energy to Failure (MJ/m^3), 
% Electrical Conductivity (s/cm), Thermal Conductivity (W/mk);

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%	
%%%%% CARBON NANOTUBE FCCVD YARNS: DATA AND PROPERTIES %%%%%%%%%%%%%%%%%%%%%%%%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

% J. N. Wang, X. G. Luo, T. Wu, Y. Chen. "High-strength carbon nanotube fibre-like
% ribbon with high ductility and high electrical conductivity". Nature Communications,
% 5, (2014), 3848.

YarnVec(1,1) = 1550;    YarnVec(1,2) = 3750;    YarnVec(1,3) = 3.71;
YarnVec(1,4) = 5;       YarnVec(1,5) = 93.75;
YarnVec(1,6) = 20450;

% Lekawa-Raus ... Koziol. "Electrical properties of carbon nanotube based
% fibers and their use in electrical wiring". Adv. Funct. Mater. Great
% review... can go through the data at a later date!!

% Li. Y-L, Kinloch I. A, Windle A. H. "Direct spinning of carbon nanotube
% fibres from chemical vapor deposition synthesis". Science, 2004;
% 304:276-278. N.B. Densities are somewhat assumed.

% Marcelo Motta, Ya-Li Li, Ian Kinloch, Alan Windle. "Mechanical properties of
% continuously spun fibers of carbon nanotubes". Nano Letters 5
% (2005), pp. 1529-1533.
% Various range of strengths and assumed density of 2.1g/cm3, but going on
% 1/5th porosity...

YarnVec(2,1) = 420; YarnVec(2,2) = 56;
YarnVec(3,1) = 420; YarnVec(3,2) = 28;
YarnVec(4,1) = 420; YarnVec(4,2) = 192;
YarnVec(5,1) = 420; YarnVec(5,2) = 292;

% Krzysztof Koziol, Juan Vilatela, Anna Moisala, Marcelo Motta, Philip Cunniff, 
% Michael Sennett, Alan Windle. "High-performance carbon nanotube fiber".
% Science 318 (2007), pp. 1892-1895.

YarnVec(6,1) = 1000;    YarnVec(6,2) = 1101;    YarnVec(6,3) = 47.4;
YarnVec(6,4) = 3.31;    YarnVec(6,5) = 12.39;
YarnVec(7,1) = 10;      YarnVec(7,2) = 5.65;    YarnVec(7,3) = 0.165;
YarnVec(7,4) = 3.97;    YarnVec(7,5) = 0.0588;

% Kelly L. Stano, Krzysztof Koziol, Martin Pick, Marcelo S. Motta, Anna Moisala,
% Juan J. Vilatela, Stuart Frasier, Alan H. Windle. "Direct spinning of carbon 
% nanotube fibres from liquid feedstock". International Journal of Material Forming,
% 1 (2008), pp. 59-62.

YarnVec(8,1) = 1000;    YarnVec(8,2) = 1000;    YarnVec(8,3) = 50.0;
YarnVec(8,6) = 8000;

% J. Chaffee, D. Lashmore, D. Lewis, J. Mann, M. Schauer, B. White. "Direct
% synthesis of CNT yarns and sheets". NSTI-Nanotech 3 (2008), pp. 118-
% Chaffee, Lashmore et al. "Direct Synthesis of CNT Yarns and Sheets"
% NSTI-Nanotech, (2008), pp. 118-121.

YarnVec(9,1) = 2000;     YarnVec(9,2) = 1700;     YarnVec(9,3) = 10.96;
YarnVec(9,4) = 37.3;     YarnVec(9,5) = 395;
YarnVec(10,1) = 2000;    YarnVec(10,2) = 1460;    YarnVec(10,3) = 10.96;
YarnVec(10,4) = 36.5;    YarnVec(10,5) = 326;
YarnVec(11,1) = 2000;    YarnVec(11,2) = 1560;    YarnVec(11,3) = 10.96;
YarnVec(11,4) = 42.0;    YarnVec(11,5) = 393;
YarnVec(12,1) = 2000;    YarnVec(12,2) = 1200;    YarnVec(12,3) = 10.96;
YarnVec(12,4) = 39.2;    YarnVec(12,5) = 286;
YarnVec(13,1) = 2000;    YarnVec(13,2) = 1100;    YarnVec(13,3) = 10.96;
YarnVec(13,4) = 40.15;   YarnVec(13,5) = 169;

% Richard J. Davies, Christian Riekel, Krzysztof K. Koziol, Juan J. Vilatela,
% Alan H. Windle. "Structural studies on carbon nanotube fibres by synchrotron
% radiation microdiffraction and microfluorescence". Journal of Applied
% Crystallography 42 (2009), pp. 1122-1128.

    % Heat Treated
YarnVec(14,1) = 950;    YarnVec(14,2) = 1045;   YarnVec(14,3) = 75;
    % As Spun
YarnVec(15,1) = 950;    YarnVec(15,2) = 1045;   YarnVec(15,3) = 50;

% R. J. Mora, J. J. Vilatela, A. H. Windle. "Properties of composites of 
% carbon nanotube fibres". Composites Science and Technology 69 (2009),
% pp. 1558-1563.

    % Pre Processing:    
YarnVec(16,1) = 550;   YarnVec(16,2) = 550;     YarnVec(16,3) = 22.0;
    % N.B: there is additional data on composites from this material!!
	
% Xiao-Hua Zhong, Ya-Li Li, Ya-Kun Liu, Xiao-Hua Qiao, Yan Feng, Ji Liang,
% Jun Jin, Lu Zhu, Feng Hou, Jin-You Li. "Continuous multilayered carbon 
% nanotube yarns". Advanced Materials 22 (2010), pp. 692-696.

YarnVec(18,1) = 1830;   YarnVec(18,2) = 1347;   YarnVec(18,3) = 48.38;
YarnVec(18,4) = 17.64;  YarnVec(18,5) = 185.22;
YarnVec(18,6) = 5000;

% Mark W. Schauer, David S. Lashmore, Diana J. Lewis, Benjamin M. Lewis, 
% Erik C. Towle. "Strength and electrical conductivity of carbon nanotube
% yarns". Material Research Society Syposium Proceedings, 1258 (2010).

YarnVec(20,1) = 2000;   YarnVec(20,2) = 900;    YarnVec(20,6) = 1538;
YarnVec(21,1) = 2000;   YarnVec(21,2) = 1020;   YarnVec(21,6) = 2083;
YarnVec(22,1) = 2000;   YarnVec(22,2) = 1300;   YarnVec(22,6) = 2273;
YarnVec(23,1) = 2000;   YarnVec(23,2) = 1060;   YarnVec(23,6) = 1786;
YarnVec(24,1) = 2000;   YarnVec(24,2) = 1226;   YarnVec(24,6) = 2041;

% Frances A. Hill. "Mechanical Energy Storage in Carbon Nanotube Springs"
% PhD Thesis, MIT, (2011)

YarnVec(25,1) = 1151;   YarnVec(25,2) = 970;    YarnVec(25,3) = 55.5;

% Qiu Li, Yi-Lan Kang, Wei Qiu, Ya-Li Li, Gan-Yun Huang, Jian-Gang Guo,
% Wei-Lin Deng, Xiao-Hua Zhong. "Deformation mechanisms of carbon nanotube
% fibres under tensile loading by in situ Raman spectroscopy analysis". 
% Nanotechnology 22 (2011), 225704.

                        YarnVec(26,2) = 300;    
YarnVec(26,4) = 11.54;  YarnVec(26,5) = 27.18;

% Amanda S. Wu, Xu Nie, Matthew C. Hudspeth, Weinong W. Chen, Tsu-Wei Chou, 
% David S. Lashmore, Mark W. Schauer, Erick Tolle, Jeff Rioux.
% "Strain rate-dependent tensile properties and dynamic electromechanical response
% of carbon nanotube fibers". Carbon 50 (2011), pp. 3876-3881.

YarnVec(27,1) = 543;    YarnVec(27,2) = 190;    YarnVec(27,3) = 2.44;   YarnVec(27,4) = 10;
YarnVec(28,1) = 543;    YarnVec(28,2) = 263;    YarnVec(28,3) = 8.69;   YarnVec(28,4) = 9;
YarnVec(29,1) = 543;    YarnVec(29,2) = 269;    YarnVec(29,3) = 13.58;  YarnVec(29,4) = 9;
YarnVec(30,1) = 543;    YarnVec(30,2) = 326;    YarnVec(30,3) = 21.72;  YarnVec(30,4) = 5;
YarnVec(31,1) = 543;    YarnVec(31,2) = 407;    YarnVec(31,3) = 19.01;  YarnVec(31,4) = 4;
YarnVec(32,1) = 543;    YarnVec(32,2) = 489;    YarnVec(32,3) = 24.44;  YarnVec(32,4) = 3;

YarnVec(33,1) = 1592;   YarnVec(33,2) = 3542;   YarnVec(33,3) = 24.44;  YarnVec(33,4) = 5.59;
	
% Amanda S. Wu, Tsu-Wei Chou, John W. Gillespie, Jr., David Lashmore, Jeff Rioux.
% "Electromechanical response and failure behaviour of aerogel-spun carbon nanotube
% fibres under tensile loading". Journal of Materials Chemistry 22 (2012),
% pp. 6792-6798.

YarnVec(34,1) = 543;    YarnVec(34,2) = 189;    YarnVec(34,3) = 9.16;
YarnVec(34,4) = 9.6;
YarnVec(34,6) = 510;

% Xiao-Hua Zhong, Ya-Li Li, Jian-Min Feng, Yan-Ru Kang, Shuai-Shuai Han. "Fabrication
% of a multifunctional carbon nanotube "cotton" yarn by the direct chemical vapor
% deposition spinning process". Nanoscale 4 (2012), pp. 5614-5618.

YarnVec(35,1) = 0.92;   YarnVec(35,2) = 0.068;  YarnVec(35,3) = 0.0024;
YarnVec(35,4) = 6.64;   YarnVec(35,5) = 0.001302;
YarnVec(35,6) = 1.8;

% Juan J. Vilatela, Alan H. Windle. "A multifunctional yarn made of carbon nanotubes"
% Journal of Engineered Fibers and Fabrics, Special Issue, (2012), pp. 23-28.

YarnVec(37,1) = 1000;   YarnVec(36,2) = 1500;   YarnVec(36,3) = 100;
YarnVec(37,6) = 8000;   YarnVec(36,7) = 45;	

% V. Sabelkin, H. E. Misak, S. Mall, R. Asmatulu, P. E. Kladitis. "Tensile loading
% behaviour of carbon nanotube wires". Carbon 50 (2012), pp. 2530-2538.

YarnVec(38,1) = 407;    YarnVec(38,2) = 256.37;     YarnVec(38,3) = 18.56;
YarnVec(38,4) = 3.259;  YarnVec(38,5) = 5.294;

% Yong-Mun Choi, Hungo Choo, Hyeonuk Yeo, Nam-Ho You, Dong Su Lee, Bon-Cheol Ku,
% Hwan Chul Kim, Pill-Hoon Bong, YoungJin Jeong, Munju Goh. "Chemical method
% for improving both the electrical conductivity and mechanical properties of
% carbon nanotube yarn via intramolecular cross-dehydrogenative coupling".
% ACS Applied Materials & Interfaces 5 (2013), pp. 7726-7730.

YarnVec(39,2) = 230;  YarnVec(39,4) = 7.9;    YarnVec(39,6) = 1800;
YarnVec(40,2) = 260;  YarnVec(40,4) = 10.1;   YarnVec(40,6) = 2820;
YarnVec(41,2) = 333;  YarnVec(41,4) = 11.5;   YarnVec(41,6) = 3240;
YarnVec(42,2) = 396;  YarnVec(42,4) = 13.7;   YarnVec(42,6) = 3350;
YarnVec(43,2) = 420;  YarnVec(43,4) = 11.1;   YarnVec(43,6) = 3500;

% H. E. Misak, V. Sabelkin, S. Mall, P. E. Kladitis. "Thermal fatigue and hypothermal
% atomic oxygen exposure behaviour of carbon nanotube wires". Carbon 57 (2013),
% pp. 42-49.

YarnVec(46,1) = 633;    YarnVec(46,2) = 209;    YarnVec(46,6) = 440;
YarnVec(47,1) = 694;    YarnVec(47,2) = 229;    YarnVec(47,6) = 429;
YarnVec(48,1) = 666;    YarnVec(48,2) = 213;    YarnVec(48,6) = 360;

% Frances A. Hill, Timothy F. Havel, David Lashmore, Mark Schauer, Carol Livermore.
% "Storing energy and powering small systems with mechanical springs made of 
% carbon nanotube yarn". Energy 76 (2014), pp. 318-325.

YarnVec(51,1) = 1163;   YarnVec(51,2) = 1000;   YarnVec(51,3) = 51.5;
YarnVec(51,4) = 3.24;   YarnVec(51,5) = 22.21;

% A. Abu Obaid, D. Heider, J. W. Gillespie Jr. "Investigation of electro-mechanical
% behaviour of carbon nanotube yarns during tensile loading". Carbon 93 (2015), 
% pp. 731-741.

YarnVec(54,1) = 698;    YarnVec(54,2) = 349;    YarnVec(54,3) = 65.3;
YarnVec(54,4) = 10.18;  YarnVec(54,5) = 29.01;
YarnVec(54,6) = 7042;

% Fengmei Guo, Can Li, Jianquan Wei, Ruiqiao Xu, Zelin Zhang, Kunlin Wang, Dehai Wu.
% "Fabrication of highly conductive carbon nanotube fibers for electrical application"
% Materials Research Express 2 (2015), 095604.

    % After Drawing: also in sheet section
YarnVec(59,1) = 650;    YarnVec(59,6) = 9000;
    % After Drawing & Rolling:
YarnVec(60,1) = 650;    YarnVec(60,6) = 10000;

% H. E. Misak, S. Mall. "Electrical conductivity, strength and microstructure of 
% carbon nanotube multi-yarns". Materials and Design 75 (2015), pp. 76-84.

YarnVec(61,1) = 410;    YarnVec(61,2) = 266;    YarnVec(61,3) = 19.5;
YarnVec(61,4) = 1.45;   YarnVec(61,5) = 2.05;   YarnVec(61,6) = 1000;
YarnVec(62,1) = 470;    YarnVec(62,2) = 280;    YarnVec(62,3) = 20.0;
YarnVec(62,4) = 3.23;   YarnVec(62,5) = 8.068;  YarnVec(62,6) = 2000;
YarnVec(63,1) = 640;    YarnVec(63,2) = 279;    YarnVec(63,3) = 17.9;
YarnVec(63,4) = 8.79;   YarnVec(63,5) = 18.35;  YarnVec(63,6) = 3000;
YarnVec(64,1) = 380;    YarnVec(64,2) = 211;    YarnVec(64,3) = 5.0;
YarnVec(64,4) = 16.94;  YarnVec(64,5) = 27.67;  YarnVec(64,6) = 2000;
YarnVec(65,1) = 470;    YarnVec(65,2) = 243;
YarnVec(66,1) = 410;    YarnVec(66,2) = 181;
YarnVec(67,1) = 500;    YarnVec(67,2) = 179;
YarnVec(68,1) = 620;    YarnVec(68,2) = 209;
YarnVec(69,1) = 510;    YarnVec(69,2) = 171;
YarnVec(70,1) = 580;    YarnVec(70,2) = 218;
YarnVec(71,1) = 550;    YarnVec(71,2) = 222;
YarnVec(72,1) = 620;    YarnVec(72,2) = 146;
YarnVec(73,1) = 650;    YarnVec(73,2) = 189;

% H. E. Misak, S. Mall. "Time-dependent electrical properties of carbon nanotube
% yarns". New Carbon Materials 30 (2015), pp. 207-213.

YarnVec(75,1) = 380;    YarnVec(75,6) = 1676;

% Thang Q. Tran, Zeng Fan, Anastasiia Mikhalchan, Peng Liu, Hai M. Duong.
% "Post-treatments for multifunctional property enhancement of carbon nanotube
% fibers from the floating catalyst method". Applied Materials & Interfaces 8
% (2016), pp. 7948-7956.

YarnVec(81,1) = 1800;   YarnVec(81,2) = 400;    YarnVec(81,3) = 14.17;
YarnVec(81,4) = 4.88;   YarnVec(81,5) = 10.62;  YarnVec(81,6) = 1325;
YarnVec(82,1) = 1530;   YarnVec(82,2) = 680;    YarnVec(82,3) = 20;
YarnVec(82,4) = 3.58;   YarnVec(82,5) = 13.5;   YarnVec(82,6) = 3500;

% Peng Liu, Zeng Fan, Anastasiia Mikhalchan, Thang Q. Tran, Daniel Jewell, 
% Hai M. Duong, Amy M. Marconnet."Continuous carbon nanotube-based fibers 
% and films for applications requiring enhanced heat dissipation".
% Applied Materials & Interfaces 8 (2016), pp. 17461-17471

	% As Spun
YarnVec(84,1) = 670;    YarnVec(84,6) = 700;    YarnVec(84,7) = 25;
	% Acid Treated 
YarnVec(86,1) = 710;    YarnVec(86,6) = 1622;   YarnVec(86,7) = 74;

% Yanan Yue, Kang Liu, Man Li, Xuejiao Hu. "Thermal manipulation of carbon 
% nanotube fiber by mechanical stretching". Carbon 77 (2014), pp. 973-979.

YarnVec(87,1) = 1650;	YarnVec(87,6) = 395;	YarnVec(87,7) = 95; 

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%	
%%%%% CARBON NANOTUBE FCCVD SHEETS: DATA AND PROPERTIES %%%%%%%%%%%%%%%%%%%%%%%
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

% Jian-Min Feng, Rui Wang, Ya-Li Li, Xiao-Hua Zhong, Lan Cui, Qian-Jin Guo,
% Feng Hou. "One-step fabrication of high quality double-walled carbon nanotube
% thin films by a chemical vapor deposition process". Carbon 48 (2010),
% pp. 3817-3824.

SheetVec(17,1) = 1670;   SheetVec(17,2) = 112;    SheetVec(17,3) = 3.42;
SheetVec(17,4) = 3.9;    SheetVec(17,5) = 2.393;
SheetVec(17,6) = 800;

% I Stuart Fraser, Marcelo S. Motta, Ron K. Schmidt, Alan H. Windle. "Continuous
% production of flexible carbon nanotube-based transparent conductive films". 
% Science and Technology of Advanced Materials 11 (2010), 045004.

SheetVec(19,1) = 6.5;    SheetVec(19,6) = 113.76;

% Dawid Janas, Krzysztof K. Kozio. "Rapid electrothermal response of high-temperature
% carbon nanotube film heaters". Carbon 59 (2013), pp. 457-463.

SheetVec(44,1) = 50;     SheetVec(44,6) = 50;

% Jim Benson, Igor Kovalenko, Sofiane Boukhalfa, David Lashmore, Mohan Sanghadasa,
% Gleb Yushin. "Multifunctional CNT-polymer composites for ultra-tough structural
% supercapacitors and desalination devices". Advanced Materials 25 (2013),
% pp. 6625-6632.

% This paper may have data in it ...

% Jae-Woo Kim, Emilie J. Siochi, Jennifer Carpena-Nunez, Kristopher E. Wise,
% John W. Connell, Yi Lin, Russell A. Wincheski. "Polyaniline/carbon nanotube
% sheet nanocomposites: fabrication and characterization". ACS Applied Materials
% & Interfaces 5 (2013), pp. 8597-8606.

SheetVec(49,1) = 566;    SheetVec(49,2) = 89.4;   SheetVec(49,3) = 0.49;
SheetVec(49,4) = 50.6;   SheetVec(49,5) = 27.1;
%SheetVec(50,1) = 816;    SheetVec(50,2) = 92.3;   SheetVec(50,3) = 7.24;
%SheetVec(50,4) = 7.24;   %SheetVec(50,5) = 40.8;

% Jae-Woo Kim, Godfrey Sauti, Emilie J. Siochi, Joseph G. Smith, Russell A. Wincheski,
% Roberto J. Cano, John W. Connell, Kristopher E. Wise.
% "Toward high performance thermoset/carbon nanotube sheet nanocomposites via 
% resistive heating assisted infiltration and cure". Applied Materials & Interfaces
% 6 (2014), pp. 18832-18843.

SheetVec(52,1) = 735;    SheetVec(52,2) = 187;    SheetVec(52,3) = 4.41;
SheetVec(52,4) = 31;     SheetVec(52,5) = 37.5;
SheetVec(53,1) = 882;    SheetVec(53,2) = 323.7;  SheetVec(53,3) = 13.23;
SheetVec(53,4) = 7.3;

% Peng Liu, Thang Q. Tran, Zeng Fan, Hai M. Duong. "Formation mechanisms and 
% morphological effects on multi-properties of carbon nanotube fibers and their
% polyimide aerogel-coated composites". Composites Science and Technology 117
% (2015), pp. 114-120.

SheetVec(55,1) = 970;    SheetVec(55,2) = 83;     SheetVec(55,3) = 0.4;
SheetVec(55,4) = 22.5;   SheetVec(55,5) = 9.56;   SheetVec(55,6) = 419;
SheetVec(56,1) = 560;    SheetVec(55,2) = 50;     SheetVec(55,3) = 0.175;
SheetVec(56,6) = 273;
SheetVec(57,1) = 400;    SheetVec(57,2) = 37;     SheetVec(57,3) = 0.125;
SheetVec(57,6) = 217;

% Fengmei Guo, Can Li, Jianquan Wei, Ruiqiao Xu, Zelin Zhang, Kunlin Wang, Dehai Wu.
% "Fabrication of highly conductive carbon nanotube fibers for electrical application"
% Materials Research Express 2 (2015), 095604.

   % Pre-Drawn: also in fibres section
SheetVec(58,1) = 300;    SheetVec(58,6) = 1250;

% Fujun Xu, Baochun Wei, Wei Liu, Hongfei Zhu, Yongyi Zhang, Yiping Qiu.
% "In-plane mechanical properties of carbon nanotube films fabricated by 
% floating catalyst chemical vapour decomposition". Journal of Materials Science 50
% (2015), pp. 8166-8174.

SheetVec(74,1) = 189;    SheetVec(74,2) = 127;    SheetVec(74,3) = 3.26;
SheetVec(74,4) = 15;     SheetVec(74,5) = 13;

% Min Li, Zhenzhen Wang, Qianli Liu, Shaokai Wang, Yizhuo Gu, Yanxia Li, Zuoguang Zhang.
% "Carbon nanotube film/epoxy composites with high strength and toughness". Polymer Composites
% 38 (2017), pp. 588-596.

SheetVec(76,1) = 470;    SheetVec(76,2) = 184.2;  SheetVec(76,3) = 3.29;
SheetVec(76,5) = 39.4;   SheetVec(76,6) = 625;

% Joseph Severino, Jenn-Ming Yang, Larry Carlson, Robert Hicks. "Progression of alignment
% in stretched CNT sheets determined by wide angle X-ray scattering". Carbon 100 (2016),
% pp. 309-317.

SheetVec(79,1) = 370;    SheetVec(79,2) = 63.4;   SheetVec(79,3) = 0.271;
SheetVec(79,5) = 27.6;   SheetVec(79,6) = 8.75;

% Jiali Yu, Weibang Lu, Shaopeng Pei, Ke Gong, Liyun Wang, Linghui Meng, Yudong Huang,
% Joseph P. Smith, Karl S. Booksh, Qingwen Li, Joon-Hyung Byun, Youngseok Oh, Yushan Yan,
% Tsu-Wei Chou. "Omnidirectionally stretchable high-performance supercapacitor based on 
% isotropic buckled carbon nanotube films". ACS Nano 10 (2016), pp. 5204-5211.

SheetVec(80,1) = 807;    SheetVec(80,2) = 209;    SheetVec(80,3) = 3.93;
SheetVec(80,4) = 14.5;   SheetVec(80,5) = 20.86;  SheetVec(80,6) = 3636;

% Heath E. Misak, James L. Rutledge, Eric D. Swenson, Shankar Mall. 
% "Thermal transport properties of dry spun carbon nanotube sheets". 
% Journal of Nanomaterials (2016), 9174085.

SheetVec(83,1) = 390;    SheetVec(83,7) = 25.0;

% Peng Liu, Zeng Fan, Anastasiia Mikhalchan, Thang Q. Tran, Daniel Jewell, 
% Hai M. Duong, Amy M. Marconnet."Continuous carbon nanotube-based fibers 
% and films for applications requiring enhanced heat dissipation".
% Applied Materials & Interfaces 8 (2016), pp. 17461-17471

	% As Spun
SheetVec(85,1) = 1190;   SheetVec(85,6) = 1998;   SheetVec(85,7) = 113;
	% Acid Condensed
SheetVec(87,1) = 1600;   SheetVec(87,6) = 4666;   SheetVec(87,7) = 759;

% Wenjun Ma, Li Song, Rong Yang, Taihua Zhang, Yuanchun Zhao, Lianfeng Sun, 
% Yan Ren, Dongfang Liu, Lifeng Liu, Jun Shen, Zhengxing Zhang, Yanjuan Xiang,
% Weiya Zhou, SiShen Xie. 
% "Directly synthesized strong, highly conducting, transparent single-walled
% carbon nanotube films". Nano Letters 7 (2007), pp. 2307-2311.

SheetVec(88,1) = 1300;	SheetVec(88,2) = 350;	SheetVec(88,3) = 4.375;
SheetVec(88,5) = 14;	SheetVec(88,6) = 2026;

% Jacob W. Singleton, Heath E. Misak, Shankar Mall. 
% "Relationships between tensile behaviour, physical parameters and manufacturing
% parameters of carbon nanotube sheet". Materials & Design 116 (2017), pp. 199-206.

SheetVec(89,1) = 380;	SheetVec(89,2) = 45.32;		SheetVec(89,3) = 1.11;
SheetVec(90,1) = 500;	SheetVec(90,2) = 25.26;		SheetVec(90,3) = 0.2;
SheetVec(91,1) = 510;	SheetVec(91,2) = 20.36;		SheetVec(91,3) = 0.32;
SheetVec(92,1) = 470;	SheetVec(92,2) = 29.80;		SheetVec(92,3) = 0.58;
SheetVec(93,1) = 580;	SheetVec(93,2) = 97.76;		SheetVec(93,3) = 2.98;
SheetVec(94,1) = 480;	SheetVec(94,2) = 63.88;		SheetVec(94,3) = 1.20;
SheetVec(95,1) = 440;	SheetVec(95,2) = 72.24;		SheetVec(95,3) = 3.16;
SheetVec(96,1) = 370;	SheetVec(96,2) = 85.84;		SheetVec(96,3) = 3.91;

% Qianli Liu, Min Li, Yizhuo Gu, Yongyi Zhang, Shaokai Wang, Qingwen Li, 
% Zuoguang Zhang. 
% "Highly aligned dense carbon nanotube sheets induced by multiple stretching and
% pressing". Nanoscale 6 (2014), pp. 4338-4344.

SheetVec( 97,1) = 470;	SheetVec( 97,2) = 186;	SheetVec( 97,3) = 3.2;
SheetVec( 97,5) = 39.48;
SheetVec( 98,1) = 530;	SheetVec( 98,2) = 307;	SheetVec( 98,3) = 11.9;
SheetVec( 98,5) = 9.54;
SheetVec( 99,1) = 680;	SheetVec( 99,2) = 416;	SheetVec( 99,3) = 13.4;
SheetVec( 99,5) = 21.76;
SheetVec(100,1) = 980;	SheetVec(100,2) = 598;	SheetVec(100,3) = 15.4;
SheetVec(100,5) = 18.62;

% Jinquan Wei, Hongwei Zhu, Yanhui Li, Bin Chen, Yi Jia, Kunlin Wang, 
% Zhicheng Wang, Wenjin Liu, Jianbin Luo, Mingxin Zheng, Dehai Wu, 
% Yanqiu Zhu, Bingqing Wei.
% "Ultrathin single-layered membranes from double-walled carbon nanotubes"
% Advanced Materials 18 (2006), pp. 1695-1700.

SheetVec(101,1) = 800;	SheetVec(101,2) = 750;	SheetVec(101,3) = 11.52;

% Wenjun Ma, Luqi Liu, Rong Yang, Taihua Zhang, Zhong Zhang, Li Song, 
% Yan Ren, Jun Shen, Zhiqiang Niu, Weiya Zhou, Sishen Xie. 
% "Monitoring a micromechanical process in macroscale carbon nanotube films and 
% fibers". Advanced Materials 21 (2009), pp. 603-608.

SheetVec(102,1) = 1300;	SheetVec(102,2) = 300;	SheetVec(102,3) = 5;

% Jack Alvarenga, Paul R. Jarosz, Chris M. Schauerman, Brian T. Moses,
% Brian J. Landi, Cory D. Cress, Ryne P. Raffaelle. 
% "High conductivity carbon nanotube wires from radial densification 
% and ionic doping".
% Applied Physics Letters 97 (2010), 182106.

SheetVec(103,1) = 1950;	SheetVec(103,6) = 13000;


end