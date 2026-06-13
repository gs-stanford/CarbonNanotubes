%==========================================================================
% propertyprogress_specificstrength.m
%==========================================================================

%% Clean up
clear; close all; clc;

%% Data
Year         = [2014, 2014, 2015, 2015, 2016, 2016, 2017, 2017, 2018, 2018, ...
                2019, 2019, 2020, 2020, 2021, 2021, 2022, 2022, 2023, 2023, 2024, 2024]';

CNTF_SPSTR   = [ 2.89,   NaN,    NaN,    NaN,    1.16,    NaN,    1.7,     NaN, ...
                  2.19,   NaN,    3.88,   4.08,   2.2,     5.5,    2.94,    3.1, ...
                  4.5,    5.5,    5.54,   4.79375, 5.8,    4.5 ]';

CNTSH_SPSTR  = [ 2.11475,2.36296,NaN,    NaN,    1.06792, 1.51351,0.80112, 1.06727, ...
                  0.10256,NaN,    NaN,    NaN,    0.9738,   0.59137,NaN,     NaN, ...
                  1.65347,1.2,    NaN,    NaN,    NaN,     NaN ]';

GF_SPSTR     = [ NaN,    NaN,    0.64828,0.61714,0.92357, 1.17124,0.26471, 0.55147, ...
                  0.6477, 0.56,   0.90047,NaN,    1.28571, 1.78947,0.21604, 0.19429, ...
                  0.5655, 0.62564,0.61025,0.67043,1.85185, 1.86316 ]';

GSH_SPSTR    = [ NaN,    NaN,    0.32357,0.43857,NaN,     NaN,    0.3375,  0.456, ...
                  0.0985, 0.1736, 0.22356,NaN,    NaN,     NaN,    0.07571, 0.09429, ...
                  NaN,    NaN,    NaN,    NaN,    NaN,     NaN ]';

%% Plot setup
% Colors (RGB) 
cols = [ 65,105,225; ...  % royalblue
        205, 92,  92; ...  % indianred
        255,165,  0; ...  % orange
        0,128,128 ]/255; % teal

markers = {'o','^','D','x'};
labels  = {'CNT Fiber','CNT Sheet','Graphene Fibre','Graphene Sheet'};

x_full = linspace(2013,2025,200);

fig=figure('Units','centimeters','Position',[5 5 12 12],'Color','none', ...
'InvertHardcopy','off'); %
hold on;

%% Define each dataset


% CNT Fibre
valid = ~isnan(CNTF_SPSTR);
scatter( Year(valid), CNTF_SPSTR(valid),  20, 'o', ...
         'MarkerEdgeColor','k', 'MarkerFaceColor','none', ...
         'DisplayName','CNT Fibre' );

% CNT Sheet
valid = ~isnan(CNTSH_SPSTR);
scatter( Year(valid), CNTSH_SPSTR(valid), 20, '^', ...
         'MarkerEdgeColor','k', 'MarkerFaceColor','none', ...
         'DisplayName','CNT Sheet' );

% Graphene Fibre
valid = ~isnan(GF_SPSTR);
scatter( Year(valid), GF_SPSTR(valid),    20, '*', ...
         'MarkerEdgeColor','k', 'MarkerFaceColor','none', ...
         'DisplayName','Graphene Fibre' );

% Graphene Sheet
valid = ~isnan(GSH_SPSTR);
scatter( Year(valid), GSH_SPSTR(valid),   20, 'x', ...
         'MarkerEdgeColor','k', 'MarkerFaceColor','none', ...
         'DisplayName','Graphene Sheet' );

legend on

 
%%%%%%%Eliminated the loop
% Loop over datasets
allY = {CNTF_SPSTR, CNTSH_SPSTR, GF_SPSTR, GSH_SPSTR};

for i = 1:4
    y = allY{i};
    valid = ~isnan(y);
    x = Year(valid);
    y = y(valid);
    
    c = cols(i,:); %increments colors but not used
    
    if i == 1
        % Linear fit (degree=1)
        p = polyfit(x,y,1);
        trend = polyval(p, x_full);
        
        % Residuals and standard deviation
        y_pred = polyval(p, x);
        res   = y - y_pred;
        sres  = std(res);
        
        % Plot trendline
        plot(x_full, trend, 'LineWidth',3, 'Color',c);
        
        % Shaded ±1σ region
        fill([x_full, fliplr(x_full)], ...
             [trend - sres, fliplr(trend + sres)], ...
             c, 'FaceAlpha',0.2, 'EdgeColor','none');
        
        % Dashed σ bounds
        plot(x_full, trend - sres, '--','LineWidth',1,'Color',c);
        plot(x_full, trend + sres, '--','LineWidth',1,'Color',c);
        
        % R² calculation
        SS_res = sum((y - y_pred).^2);
        SS_tot = sum((y - mean(y)).^2);
        R2 = 1 - SS_res/SS_tot;
        fprintf('R^2 for CNTF_SPSTR trendline: %.4f\n', R2);
        
    else
        % Plot mean and ±1σ band
        ym = mean(y);
        ys = std(y);
        const = ym * ones(size(x_full));
        
        plot(x_full, const, 'LineWidth',3,'Color',c);
        fill([x_full, fliplr(x_full)], ...
             [const - ys, fliplr(const + ys)], ...
             c, 'FaceAlpha',0.2, 'EdgeColor','none');
        plot(x_full, const - ys, '--','LineWidth',1,'Color',c);
        plot(x_full, const + ys, '--','LineWidth',1,'Color',c);
    end
    
    % Scatter points
    scatter(x, y, 20, 'Marker', markers{i}, ...
            'MarkerEdgeColor', [0 0 0], 'MarkerFaceColor', 'none');
end
%}



box on;
%% Final styling
xlim([2013.5, 2024.5]);
ylim([0, 6.5]);
xlabel('Year','FontSize',11,'FontName','Helvetica');
ylabel('Specific Strength (GPa/SG)','FontSize',11,'FontName','Helvetica');
%legend(labels,'FontSize',11,'Location','best');
set(gca, ...
    'LineWidth', 1, ...               % Border thickness
    'TickDir', 'in', ...              % Tick direction
    'TickLength', [0.015 0.005], ...  % Major and minor tick length
    'FontSize', 11, ...               % Tick label font size
    'FontName', 'Helvetica', ...       % Font family
    'Color','none'...
);


% Tight layout
set(gca,'LooseInset', max(get(gca,'TightInset'), 0.02));

% Save as SVG at 900 dpi
%print(gcf, 'Fig2_StrengthProgress0.svg', '-dsvg', '-r900');

hold off;
