function [BuckyVec] = BuckyDatas()

%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
% DATA FROM DIFFERENT STUDIES ON BUCKYPAPERS: VARIOUS PROPERTIES/SOURCES  %
%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

BuckyVec   = zeros(100,7);

% BuckyVec is [ Density (kg/m3), Strength (MPa), Stiffness (GPa), 
% Ductility (%), Energy to Failure (MJ/m^3), 
% Electrical Conductivity (s/cm), Thermal Conductivity (W/mk); 

%---- PAPERS & DATA ------------------------------------------------------%

% Chunming Niu, Enid K. Sichel, Robert Hoch, David Moy, Howard Tennent. 
% "High power electrochemical capacitors based on carbon nanotube electrodes"
% Applied Physics Letters 70 (1997), pp. 1480-1482.

BuckyVec(1,1) = 800;							BuckyVec(1,6) = 62.5;

% Ray H. Baughman, Changxing Cui, Anvar A. Zakhidov, Zafar Iqbal, Joseph N. Barisci,
% Geoff M. Spinks, Gordon G. Wallace, Alberto Mazzoldi, Danilo De Rossi, 
% Andrew G. Rinzler, Oliver Jaschinski, Siegmar Roth, Miklos Kertesz.
% "Carbon Nanotube Actuators". Science 284 (1999), pp. 1340-1344.

BuckyVec(2,1) = 350;							BuckyVec(2,3) = 1.2;
												BuckyVec(2,6) = 5000;
												
% Shiren Wang, Zhiyong Liang, Ben Wang, Chuck Zhang. "High-strength and multifunctional
% macroscopic fabric of single-walled carbon nanotubes". Advanced Materials 19 (2007),
% pp. 1257-1261.

BuckyVec(3,1) = 600;	BuckyVec(3,2) = 6;		BuckyVec(3,3) = 1.5;
BuckyVec(4,1) = 600;	BuckyVec(4,2) = 15;

%-------------------------------------------------------------------------------------------%
% REVIEW PAPERS: partly for buckypapers and partly for films...								%
%																							%
% Qing Cao, John A. Rogers. "Ultrathin films of single-walled carbon nanotubes				%
% for electronics and sensors: a review of fundamental and applied aspects". 				%
% Advanced Materials 21 (2009), pp. 29-53.													%
%																							%
% G. Gruner. "Carbon nanotube films for transparent and plastic electronics"				%
% Journal of Materials Chemistry 16 (2006), pp. 3533-3539.									%
%																							%
% Hongwei Zhu, Bingqing Wei. "Assembly and applications of carbon nanotube thin films"		%
% Journal of Materials Science and Technology 24 (2008), pp. 447-456.						%
%																							%
% Guanghui Xu, Qian Zhang, Weiping Zhou, Jiaqi Huang, Fei Wei. 								%
% "The feasibiliy of producing MWCNT paper and strong MWCNT film from VACNT array"			%
% Applied Physics A 92 (2008), pp. 531-539.													%
% 																							%
% Jiangtao Di, Xin Wang, Yajuan Xing, Yongyi Zhang, Xiaohua Zhang, Weibang Liu, Qingwen Li,	%
% Yuntian T. Zhu. 																			%
% "Dry-processable carbon nanotubes for functional devices and composites". Smal 10 (2014), %
% pp. 4606-4625.																			%
%																							%
% Jiangtao Di, Xiaohua Zhang, Zhenzhong Yong, Yongyi Zhang, Da Li, Ru Li, Qingwen Li. 		%
% "Carbon-nanotube fibers for wearable devices and smart textiles"							%
% Advanced Materials 28 (2016), pp. 10529-10538.											%
%																							%
%-------------------------------------------------------------------------------------------%

% T. V. Sreekumar, Tao Liu, Satish Kumar, Lars M. Ericson, Robert H. Hauge, Richard E. Smalley
% "Single-wall carbon nanotube films". Chemistry of Materials 15 (2003),
% pp. 175-178.

BuckyVec(5,1) = 900;	BuckyVec(5,2) = 30;		BuckyVec(5,3) = 8;
BuckyVec(5,6) = 1000;

% Ding Wang, Pengcheng Song, Canghong Liu, Wei Wu, Shoushan Fan. 
% "Highly oriented carbon nanotube papers made of aligned carbon nanotubes"
% Nanotechnology 19 (2008), 075609.

BuckyVec(6,1) = 540;	BuckyVec(6,6) = 150;	BuckyVec(6,7) = 81;

% A. D. Bozhko, D. E. Sklovsky, V. A. Nalimova, A. G. Rinzler, R. E. Smalley, J. E. Fischer.
% "Resistance vs. pressure of single-wall carbon nanotubes"
% Applied Physics A 67 (1998), pp. 75-77.

%BuckyVec(7,1) = 5;		BuckyVec(7,6) = 100;

% Philip G. Whitten, Adrian A. Gestos, Geoffrey M. Spinks, Kerry J. Gilmore, Gordon G. Wallace.
% "Free standing carbon nanotube composite bio-electrodes"
% Journal of Biomedical Materials Research Part B: Applied Biomaterials 82B (2007), pp. 37-43.

BuckyVec(8,1) = 640;	BuckyVec(8,2) = 16;		BuckyVec(8,3) = 4;
BuckyVec(8,6) = 247;

% Sharali Malik, Harald Rösner, Frank Hennrich, Artur Böttcher, Manfred M. Kappes, Tilmann beck,
% Markus Auhorn. 
% "Failure mechanism of free standing single-walled carbon nanotube thin films under tensile load"
% Physical Chemistry Chemical Physics 6 (2004), pp. 3540-3544.

BuckyVec( 9,1) = 500;	BuckyVec( 9,2) = 12.5;	BuckyVec( 9,3) = 1.1;
BuckyVec(10,1) = 800;	BuckyVec(10,2) = 23.0;	BuckyVec(10,3) = 2.0;

% I-Wen Peter Chen, Richard Liang, Haibo Zhao, Ben Wang, Chuck Zhang.
% "Highly conductive carbon nanotube buckypapers with improved doping stability via
% conjugational cross-linking"
% Nanotechnology 22 (2011), 485708.

	% SWNT Buckypaper
BuckyVec(11,1) = 1000; 	BuckyVec(11,2) = 20;	BuckyVec(11,3) = 2.25;
BuckyVec(11,6) = 150;
	% With acid treatment
BuckyVec(12,1) = 1000;							BuckyVec(12,6) = 330;

% Wen-Tai Hong, Nyan-Hwa Tai. "Investigations on the thermal conductivity of composites
% reinforced with carbon nanotubes"
% Diamond and Related materials 17 (2008), pp. 1577-1581.

	% SWNT
BuckyVec(13,1) = 670;							BuckyVec(13,7) = 2.24;
	% MWNT
BuckyVec(14,1) = 690;							BuckyVec(14,7) = 0.36;

% Hongyuan Chen, Minghai Chen, Jiangtao Di, Geng Xu, Hongbo Li, Qingwen Li.
% "Architecting three-dimensional networks in carbon nanotube buckypapers for 
% thermal interface materials"
% Journal of Physical Chemistry C 116 (2012), pp. 3903-3909.

BuckyVec(15,1) = 470;							BuckyVec(15,7) = 1.2;

% J. E. Fischer, W. Zhou, J. Vavro, M. C. Llaguno, C. Guthy, R. Haggenmueller, 
% M. J. Casavant, D. E. Walters, R. E. Smalley. "Magnetically aligned single wall
% carbon nanotube films: preferred orientation and anisotropic transport properties"
% Journal of Applied Physics 93 (2003), pp. 2157-2163.

BuckyVec(16,1) = 600;							BuckyVec(16,6) = 1098;

% Michael B. Jukubinek, Benham Ashrafi, Jingwen Guan, Michael B. Johnson, 
% Mary Anne White, Benoit Simard.
% "3D chemically cross-linked single-walled carbon nanotube buckypapers"
% RSC Advances 4 (2014), pp. 57564-57573.

BuckyVec(17,1) = 420;		BuckyVec(17,2) = 3.4;	BuckyVec(17,3) = 0.37;
BuckyVec(17,4) = 1.6;		BuckyVec(17,6) = 117;	BuckyVec(17,7) = 2.4;
BuckyVec(18,1) = 270;		BuckyVec(18,2) = 3.0;	BuckyVec(18,3) = 0.4;
BuckyVec(18,4) = 0.7;		BuckyVec(18,6) = 45;	BuckyVec(18,7) = 1.1;

end